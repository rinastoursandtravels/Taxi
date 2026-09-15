import { NextRequest } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isUuid } from '@/lib/validation'
import { logSystemEvent } from '@/lib/system-events'
import {
  computeHoldExpiry,
  getFreeBookingSettings,
  isFreeBookingEnabledFor,
  istWallClockToInstantMs,
} from '@/lib/free-booking'

export const dynamic = 'force-dynamic'

/**
 * Convert an already-created booking into a free ("pay later") one.
 *
 * The booking row itself is created first by /api/bookings/create, exactly as
 * it is for an online checkout. This endpoint only marks it as deliberately
 * unpaid: it sets the vehicle hold window and opens a payments row with zero
 * collected, so an admin has something to record cash against later.
 *
 * Deliberately sends NO email. Customers see unpaid bookings in their Bookings
 * tab; mail is reserved for payment and vehicle assignment.
 */
export async function POST(request: NextRequest) {
  try {
    // --- Identity ---------------------------------------------------------
    // Login is mandatory before checkout in both booking flows, so a session
    // must exist. Taking the email from the verified session (never the body)
    // is what makes the per-account limit below meaningful.
    const supabaseAuth = createRouteHandlerClient({ cookies })
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser()

    if (authError || !user?.email) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const bookingId = body?.bookingId

    if (!isUuid(bookingId)) {
      return Response.json({ success: false, error: 'Booking not found' }, { status: 404 })
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select(
        'id, booking_id, booking_type, booking_status, payment_mode, hold_expires_at, amount_total, start_datetime, user_email, user_name'
      )
      .eq('id', bookingId)
      .maybeSingle()

    if (bookingError) {
      console.error('[CONFIRM-UNPAID] booking lookup failed:', bookingError)
      return Response.json({ success: false, error: 'Failed to look up booking' }, { status: 500 })
    }

    if (!booking) {
      return Response.json({ success: false, error: 'Booking not found' }, { status: 404 })
    }

    // --- Ownership --------------------------------------------------------
    if (booking.user_email?.toLowerCase() !== user.email.toLowerCase()) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 })
    }

    // Already converted: succeed idempotently so a double-click or a retry
    // after a dropped response can never produce a second payments row.
    if (booking.payment_mode === 'pay_later') {
      return Response.json({
        success: true,
        alreadyUnpaid: true,
        booking,
        holdExpiresAt: booking.hold_expires_at,
      })
    }

    if (booking.booking_status !== 'pending') {
      return Response.json(
        { success: false, error: 'Only a pending booking can be marked unpaid' },
        { status: 409 }
      )
    }

    // --- A paid booking can never be downgraded ---------------------------
    // A payments row exists only once money has been recorded against the
    // booking. If one is already there, this request must not touch it.
    const { data: existingPayment, error: paymentLookupError } = await supabaseAdmin
      .from('payments')
      .select('id, payment_status')
      .eq('booking_id', booking.booking_id)
      .maybeSingle()

    if (paymentLookupError) {
      console.error('[CONFIRM-UNPAID] payment lookup failed:', paymentLookupError)
      return Response.json(
        { success: false, error: 'Failed to verify payment state' },
        { status: 500 }
      )
    }

    if (existingPayment) {
      await logSystemEvent({
        severity: 'security',
        event_type: 'free_booking_rejected_existing_payment',
        actor_type: 'user',
        actor_label: user.email,
        entity_type: 'booking',
        entity_id: booking.booking_id,
        message: 'Attempt to mark a booking unpaid when a payment already exists',
        metadata: { payment_status: existingPayment.payment_status },
      })
      return Response.json(
        { success: false, error: 'This booking already has a payment recorded' },
        { status: 409 }
      )
    }

    // --- Policy -----------------------------------------------------------
    const settings = await getFreeBookingSettings()

    if (!isFreeBookingEnabledFor(booking.booking_type, settings)) {
      return Response.json(
        { success: false, error: 'Free booking is not available for this service right now' },
        { status: 403 }
      )
    }

    const now = Date.now()
    const startMs = istWallClockToInstantMs(booking.start_datetime)

    // A start time we cannot parse skips the window checks rather than
    // rejecting an otherwise valid booking; the hold then falls back to the
    // plain window inside computeHoldExpiry.
    if (!Number.isNaN(startMs)) {
      const hoursUntilStart = (startMs - now) / (60 * 60 * 1000)

      if (settings.minLeadHours > 0 && hoursUntilStart < settings.minLeadHours) {
        return Response.json(
          {
            success: false,
            code: 'LEAD_TIME',
            error: `Free booking needs at least ${settings.minLeadHours} hour(s) notice. Please pay online to confirm this trip.`,
          },
          { status: 409 }
        )
      }

      if (hoursUntilStart > settings.maxAdvanceDays * 24) {
        return Response.json(
          {
            success: false,
            code: 'TOO_FAR_AHEAD',
            error: `Free booking is only available up to ${settings.maxAdvanceDays} days in advance.`,
          },
          { status: 409 }
        )
      }
    }

    // --- Per-account limit ------------------------------------------------
    // Keyed on the authenticated email: phone is free text and never verified,
    // while this address is tied to a real Supabase Auth account. Supabase
    // normalises auth emails to lower case and the booking form prefills from
    // the session, so an exact match is the right comparison here.
    //
    // Only bookings whose hold is STILL LIVE count. The limit exists to stop
    // one account tying up the fleet, and a lapsed hold ties up nothing — its
    // vehicle was released back to everyone else the moment hold_expires_at
    // passed. Counting lapsed rows would permanently lock a customer out of
    // free booking, because these rows are deliberately never auto-deleted
    // (see cleanup-pending). A NULL expiry is treated as live, matching
    // isVehicleHoldActive, which holds indefinitely when no expiry is set.
    const nowIso = new Date().toISOString()
    const { count: openUnpaid, error: countError } = await supabaseAdmin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('user_email', user.email)
      .eq('payment_mode', 'pay_later')
      .eq('booking_status', 'pending')
      .or(`hold_expires_at.is.null,hold_expires_at.gt.${nowIso}`)

    if (countError) {
      console.error('[CONFIRM-UNPAID] open booking count failed:', countError)
      return Response.json(
        { success: false, error: 'Failed to check booking limit' },
        { status: 500 }
      )
    }

    if ((openUnpaid ?? 0) >= settings.maxOpenPerUser) {
      return Response.json(
        {
          success: false,
          code: 'LIMIT_REACHED',
          error: `You already have ${openUnpaid} unpaid booking(s) still holding a vehicle. Please pay or cancel one before booking again.`,
        },
        { status: 409 }
      )
    }

    // --- Write ------------------------------------------------------------
    const holdExpiresAt = computeHoldExpiry({
      bookingType: booking.booking_type,
      startDatetime: booking.start_datetime,
      settings,
      now,
    })

    // Payments row first. If this succeeds but the booking update below fails,
    // the booking simply stays 'online_full' with a harmless unpaid row, and a
    // retry heals it (the duplicate insert is tolerated). The reverse order
    // could leave an unpaid booking with nothing for an admin to collect
    // against, which is the state we must never produce.
    const { error: paymentInsertError } = await supabaseAdmin.from('payments').insert([
      {
        booking_id: booking.booking_id,
        payment_type: 'cash',
        amount_total: booking.amount_total,
        amount_online_paid: 0,
        amount_cash_paid: 0,
        txn_status: 'pending',
        payment_status: 'unpaid',
      },
    ])

    // 23505 = unique violation on payments.booking_id: a concurrent retry won
    // the race and the row already exists. That is the desired end state.
    if (paymentInsertError && paymentInsertError.code !== '23505') {
      console.error('[CONFIRM-UNPAID] payment insert failed:', paymentInsertError)
      return Response.json(
        { success: false, error: 'Failed to open the unpaid payment record' },
        { status: 500 }
      )
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({ payment_mode: 'pay_later', hold_expires_at: holdExpiresAt })
      .eq('id', booking.id)
      .eq('booking_status', 'pending')
      .select()
      .single()

    if (updateError || !updated) {
      console.error('[CONFIRM-UNPAID] booking update failed:', updateError)
      return Response.json(
        { success: false, error: 'Failed to mark the booking as unpaid' },
        { status: 500 }
      )
    }

    await logSystemEvent({
      severity: 'info',
      event_type: 'free_booking_created',
      actor_type: 'user',
      actor_label: user.email,
      entity_type: 'booking',
      entity_id: booking.booking_id,
      message: `Free (unpaid) booking submitted (${booking.booking_type})`,
      metadata: {
        booking_type: booking.booking_type,
        amount_total: booking.amount_total,
        hold_expires_at: holdExpiresAt,
      },
    })

    return Response.json({ success: true, booking: updated, holdExpiresAt })
  } catch (error) {
    console.error('[CONFIRM-UNPAID] unexpected error:', error)
    await logSystemEvent({
      severity: 'error',
      event_type: 'free_booking_failed',
      actor_type: 'system',
      message: 'Free booking conversion failed',
      metadata: { error: error instanceof Error ? error.message : String(error) },
    })
    return Response.json({ success: false, error: 'Failed to submit free booking' }, { status: 500 })
  }
}
