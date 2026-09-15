import { createRazorpayOrder } from '@/lib/payment'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getConflictControlEnabled, getModelAvailability } from '@/lib/conflicts'

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
    // exactly that. This stops a tampered client from creating a ₹1 order for a
    // real booking.
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select(
        'booking_id, amount_total, booking_status, booking_type, car_model, start_datetime, end_datetime'
      )
      .eq('id', bookingId)
      .single()

    if (error || !booking) {
      return Response.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Terminal states are not payable. Without this, a cancelled booking could
    // still open an order, and record_online_payment would then flip it back to
    // 'confirmed' — resurrecting a booking the customer (or an admin) had
    // already cancelled. Cancelled 'pay later' bookings are especially exposed:
    // they keep their unpaid payments row, so the 'already paid' guard below
    // does not catch them either.
    if (booking.booking_status === 'cancelled' || booking.booking_status === 'completed') {
      return Response.json(
        { error: 'This booking is no longer open for payment.' },
        { status: 409 }
      )
    }

    // Re-opening this endpoint to "pay later" bookings (below) makes this a
    // real path now: a customer could hit "Pay Now" after the team has
    // already collected cash for the same booking — e.g. two tabs, or a
    // support call that finished while this page was still open. Refuse
    // outright rather than opening a second Razorpay order for a settled
    // booking.
    //
    // payments.booking_id references bookings.booking_id (the business key),
    // NOT bookings.id (the PK this endpoint is keyed on) — using the wrong one
    // here would silently never match.
    const { data: existingPayment } = await supabaseAdmin
      .from('payments')
      .select('payment_status')
      .eq('booking_id', booking.booking_id)
      .maybeSingle()

    if (existingPayment?.payment_status === 'paid') {
      return Response.json({ error: 'This booking has already been paid.' }, { status: 409 })
    }

    // A "pay later" booking CAN be paid online — that is the self-serve way a
    // customer guarantees their vehicle before the hold expires, instead of
    // waiting for the team to collect cash. This is safe because
    // record_online_payment (sql/free_booking_online_payment.sql) now
    // correctly promotes amount_online_paid and payment_type on an existing
    // unpaid row, rather than silently leaving them at zero.
    const total = Number(booking.amount_total)
    if (!Number.isFinite(total) || total <= 0) {
      return Response.json({ error: 'Booking has no payable amount' }, { status: 400 })
    }

    // Full payment is the only online option. The 30% advance was removed, so
    // any other paymentType is either a stale client or a tampered request —
    // either way it must not be able to open a part-value order and land the
    // booking in 'partial', a state new bookings can no longer legitimately
    // reach. Legacy partial rows are settled by an admin via confirm-cash.
    if (paymentType && paymentType !== 'full') {
      return Response.json(
        { error: 'Only full online payment is supported' },
        { status: 400 }
      )
    }

    // --- The slot must still be free -------------------------------------
    // Availability is otherwise only ever enforced at /api/bookings/create. A
    // 'pay later' hold releases its vehicle once hold_expires_at passes, so by
    // the time the customer returns to pay, the slot can already belong to
    // someone else. Opening an order without re-checking would take full
    // payment for a vehicle that no longer exists, leaving two confirmed
    // bookings against one car and a refund to sort out.
    //
    // The booking excludes ITSELF from the count: while its own hold is live it
    // legitimately occupies the slot, so counting it would refuse every
    // ordinary checkout, including the very first one straight after booking.
    //
    // Tours deliberately do not hard-fail here, mirroring the same decision in
    // /api/bookings/create: a tour is booked against a *preferred* model and
    // the team may assign another suitable vehicle.
    const conflictControlEnabled = await getConflictControlEnabled()

    if (
      conflictControlEnabled &&
      booking.car_model &&
      booking.booking_type !== 'tour' &&
      booking.start_datetime &&
      booking.end_datetime
    ) {
      const availability = await getModelAvailability(
        booking.car_model,
        { start: booking.start_datetime, end: booking.end_datetime },
        { excludeBookingId: booking.booking_id }
      )

      if ((availability?.available_count || 0) <= 0) {
        return Response.json(
          {
            code: 'MODEL_UNAVAILABLE',
            error: `${booking.car_model} is no longer available for your selected date and time — the slot was taken while this booking was unpaid. Please contact us to arrange another vehicle.`,
          },
          { status: 409 }
        )
      }
    }

    const amount = total

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
