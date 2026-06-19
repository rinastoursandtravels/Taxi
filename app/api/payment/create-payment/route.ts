import { supabaseAdmin } from '@/lib/supabase-admin'
import { recordOnlinePaymentAtomic } from '@/lib/payment-db'
import { sendBookingConfirmation, sendAdminNotification } from '@/lib/resend-notifications'
import { generateInvoiceNumber } from '@/lib/utils'
import { logSystemEvent } from '@/lib/system-events'
import { NextRequest } from 'next/server'

/**
 * Generic "record a payment" endpoint.
 *
 * NOTE: The live checkout flow uses /api/payment/verify (+ the webhook). This
 * endpoint is kept for admin/manual/programmatic use and now delegates to the
 * SAME atomic, idempotent RPC (recordOnlinePaymentAtomic) so there is exactly
 * one write path — it can never produce a confirmed booking without a payment.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      bookingId,
      amountOnlinePaid,
      txnId,
      txnStatus = 'success',
      orderId,
    } = body

    if (!bookingId || amountOnlinePaid === undefined) {
      return Response.json(
        { success: false, error: 'Missing required fields: bookingId, amountOnlinePaid' },
        { status: 400 }
      )
    }

    if (txnStatus !== 'success') {
      return Response.json(
        { success: false, error: 'Only successful transactions can be recorded here' },
        { status: 400 }
      )
    }

    const capturedAmount = parseFloat(String(amountOnlinePaid))
    if (isNaN(capturedAmount) || capturedAmount <= 0) {
      return Response.json(
        { success: false, error: `Invalid amountOnlinePaid: ${amountOnlinePaid}` },
        { status: 400 }
      )
    }

    // Fetch booking (for emails + response).
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, booking_id, amount_total, booking_type, user_name, user_email, start_datetime, car_model, destination_id, tour_package_id')
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      return Response.json(
        { success: false, error: `Booking not found with ID: ${bookingId}` },
        { status: 404 }
      )
    }

    // Atomic, idempotent write + confirm.
    const invoiceNumber = generateInvoiceNumber()
    const { data: result, error: recordError } = await recordOnlinePaymentAtomic({
      bookingUuid: booking.id,
      txnId: txnId || `manual_${Date.now()}`,
      orderId: orderId || null,
      capturedAmount,
      invoice: invoiceNumber,
    })

    if (recordError || !result) {
      await logSystemEvent({
        severity: 'error',
        event_type: 'payment_record_failed',
        actor_type: 'admin',
        entity_type: 'booking',
        entity_id: booking.booking_id,
        message: 'create-payment failed to record payment',
        metadata: { bookingId, capturedAmount, error: String(recordError) },
      })
      return Response.json(
        { success: false, error: 'Failed to record payment in database', details: String(recordError) },
        { status: 500 }
      )
    }

    // Confirmation emails (best-effort).
    if (booking.user_email) {
      let destinationName = ''
      if (booking.destination_id) {
        const { data: dest } = await supabaseAdmin.from('destinations').select('name').eq('id', booking.destination_id).single()
        destinationName = dest?.name || ''
      } else if (booking.tour_package_id) {
        const { data: tour } = await supabaseAdmin.from('tour_packages').select('name').eq('id', booking.tour_package_id).single()
        destinationName = tour?.name || ''
      }

      const totalAmount = Number(booking.amount_total)
      const paymentMethod = capturedAmount >= totalAmount - 0.01 ? 'full' : 'partial'
      const amountDue = Math.max(0, totalAmount - capturedAmount)
      const pickupDate = booking.start_datetime ? booking.start_datetime.split('T')[0] : ''
      const pickupTime = booking.start_datetime
        ? new Date(booking.start_datetime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        : ''

      await Promise.allSettled([
        sendBookingConfirmation({
          to: booking.user_email,
          bookingId: booking.booking_id,
          userName: booking.user_name || 'Customer',
          bookingType: booking.booking_type || 'taxi',
          destination: booking.booking_type !== 'tour' ? destinationName : undefined,
          tourPackageName: booking.booking_type === 'tour' ? destinationName : undefined,
          pickupDate,
          pickupTime,
          carType: booking.car_model || 'Economy',
          totalAmount,
          amountPaid: capturedAmount,
          amountDue,
          paymentMethod,
        }),
        sendAdminNotification({
          bookingId: booking.booking_id,
          userEmail: booking.user_email,
          userName: booking.user_name || 'Customer',
          totalAmount,
          bookingType: booking.booking_type || 'taxi',
          destination: destinationName,
          pickupDate,
        }),
      ])
    }

    return Response.json(
      {
        success: true,
        message: 'Payment recorded successfully',
        paymentId: result.payment_id,
        bookingId: booking.booking_id,
        invoiceNumber,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('=== Error in create-payment endpoint ===', error)
    return Response.json(
      {
        success: false,
        error: 'Internal server error while processing payment',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
