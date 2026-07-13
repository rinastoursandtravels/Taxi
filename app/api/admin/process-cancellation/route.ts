import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { refundPayment } from '@/lib/payment'
import { requireAdminRequest } from '@/lib/admin-auth'
import { isUuid } from '@/lib/validation'

export const dynamic = 'force-dynamic'

function toNum(val: unknown): number {
  const n = parseFloat(String(val ?? 0))
  return isNaN(n) ? 0 : n
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminRequest(request)
  if (unauthorized) return unauthorized

  try {
    const { booking_id, action, refund_amount, refund_notes } = await request.json()

    if (!booking_id || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Invalid request parameters' }, { status: 400 })
    }

    if (!isUuid(booking_id)) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 })
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, booking_id, booking_status, cancellation_requested_at, user_name')
      .or(`id.eq.${booking_id},booking_id.eq.${booking_id}`)
      .limit(1)
      .maybeSingle()

    if (bookingError || !booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 })
    }

    if (!booking.cancellation_requested_at) {
      return NextResponse.json(
        { success: false, error: 'No pending cancellation request for this booking' },
        { status: 400 }
      )
    }

    // Reject — clear the request, booking stays confirmed
    if (action === 'reject') {
      const { error } = await supabaseAdmin
        .from('bookings')
        .update({ cancellation_requested_at: null, cancellation_reason: null })
        .eq('id', booking.id)
      if (error) throw error
      return NextResponse.json({ success: true, message: 'Cancellation request rejected. Booking remains confirmed.' })
    }

    // Approve — process refund then cancel the booking
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('id, booking_id, txn_id, amount_online_paid, payment_type, refund_status')
      .eq('booking_id', booking.booking_id)
      .maybeSingle()

    if (paymentError || !payment) {
      return NextResponse.json({ success: false, error: 'Payment record not found' }, { status: 404 })
    }

    if (payment.refund_status === 'processed') {
      return NextResponse.json({ success: false, error: 'A refund has already been processed for this booking' }, { status: 400 })
    }

    const refundAmt = refund_amount != null ? parseFloat(refund_amount) : toNum(payment.amount_online_paid)
    let refundId: string | null = null

    if (refundAmt > 0 && payment.txn_id) {
      try {
        const refund = await refundPayment(payment.txn_id, refundAmt)
        refundId = String(refund.id)
      } catch (rzpError: unknown) {
        console.error('[PROCESS-CANCELLATION] Razorpay refund failed:', rzpError)
        const errMsg = rzpError instanceof Error ? rzpError.message : 'Unknown gateway error'
        return NextResponse.json(
          { success: false, error: `Refund gateway error: ${errMsg}. Process the refund manually if needed.` },
          { status: 502 }
        )
      }
    }

    // Update payment with refund details
    const { error: paymentUpdateError } = await supabaseAdmin
      .from('payments')
      .update({
        refund_status: 'processed',
        refund_amount: refundAmt,
        refund_id: refundId,
        refunded_at: new Date().toISOString(),
        refund_notes: refund_notes?.trim() || null,
      })
      .eq('id', payment.id)

    if (paymentUpdateError) {
      console.error('[PROCESS-CANCELLATION] Payment update error:', paymentUpdateError)
    }

    // Cancel the booking and clear the cancellation request flag
    const { error: bookingUpdateError } = await supabaseAdmin
      .from('bookings')
      .update({ booking_status: 'cancelled', cancellation_requested_at: null })
      .eq('id', booking.id)

    if (bookingUpdateError) throw bookingUpdateError

    return NextResponse.json({
      success: true,
      message: refundId
        ? `Refund of Rs. ${refundAmt.toFixed(2)} initiated via Razorpay. Booking cancelled.`
        : `Booking cancelled. No online payment to refund (Rs. ${refundAmt.toFixed(2)}).`,
      refund_id: refundId,
      refund_amount: refundAmt,
    })
  } catch (error) {
    console.error('[PROCESS-CANCELLATION] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process cancellation' },
      { status: 500 }
    )
  }
}
