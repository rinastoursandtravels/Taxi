import { createRazorpayOrder } from '@/lib/payment'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { bookingId, paymentType } = body

    if (!bookingId) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Never trust a client-supplied amount. Resolve the authoritative total from
    // the booking row (itself server-derived from fares / tour price) and charge
    // either the full amount or the 30% advance. This stops a tampered client
    // from creating a ₹1 order for a real booking.
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select('amount_total, booking_status')
      .eq('id', bookingId)
      .single()

    if (error || !booking) {
      return Response.json({ error: 'Booking not found' }, { status: 404 })
    }

    const total = Number(booking.amount_total)
    if (!Number.isFinite(total) || total <= 0) {
      return Response.json({ error: 'Booking has no payable amount' }, { status: 400 })
    }

    const amount =
      paymentType === 'full' ? total : Math.round(total * 0.3 * 100) / 100

    const order = await createRazorpayOrder(amount, bookingId)

    return Response.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    })
  } catch (error) {
    console.error('Order creation error:', error)
    return Response.json(
      { error: 'Failed to create payment order' },
      { status: 500 }
    )
  }
}
