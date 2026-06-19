import { verifyRazorpayPayment, getPaymentDetails } from '@/lib/payment'
import { sendBookingConfirmation, sendAdminNotification } from '@/lib/resend-notifications'
import { generateInvoiceNumber } from '@/lib/utils'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { recordOnlinePaymentAtomic } from '@/lib/payment-db'
import { logSystemEvent } from '@/lib/system-events'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { orderId, paymentId, signature, bookingId, bookingType, paymentMethod } = body

    // ── STEP 1: Log incoming payload ───────────────────────────────────────────
    console.log('[VERIFY] ══════════════════════════════════')
    console.log('[VERIFY] STEP 1 — Incoming payload:')
    console.log('[VERIFY]   bookingId:', bookingId)
    console.log('[VERIFY]   paymentId:', paymentId)
    console.log('[VERIFY]   orderId:', orderId)

    // ── STEP 2: Verify Razorpay signature ─────────────────────────────────────
    console.log('[VERIFY] STEP 2 — Verifying Razorpay signature...')
    const isValidSignature = verifyRazorpayPayment(orderId, paymentId, signature)
    if (!isValidSignature) {
      console.error('[VERIFY] ❌ Invalid signature for order', orderId)
      await logSystemEvent({
        severity: 'security',
        event_type: 'payment_signature_invalid',
        actor_type: 'user',
        entity_type: 'booking',
        entity_id: bookingId,
        message: 'Razorpay payment signature verification failed',
        metadata: { orderId, paymentId },
      })
      return Response.json({ success: false, error: 'Invalid payment signature' }, { status: 400 })
    }
    console.log('[VERIFY] ✅ Signature valid')

    // ── STEP 3: Fetch booking (for emails + response) ─────────────────────────
    console.log('[VERIFY] STEP 3 — Fetching booking from DB...')
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, booking_id, booking_status, booking_type, amount_total, user_name, user_email, start_datetime, car_model, destination_id, tour_package_id')
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      console.error('[VERIFY] ❌ Booking not found:', bookingError)
      return Response.json({ success: false, error: 'Booking not found' }, { status: 404 })
    }
    console.log('[VERIFY] ✅ Booking found — booking_id:', booking.booking_id)

    // ── STEP 4: Confirm capture with Razorpay (source of truth) ───────────────
    // FAIL-CLOSED: if we cannot confirm the payment was actually captured, do NOT
    // record or confirm anything. The webhook / reconciliation job will heal it.
    // The money is safe at Razorpay either way.
    console.log('[VERIFY] STEP 4 — Confirming capture with Razorpay...')
    let capturedAmount: number | null = null
    try {
      const rzpPayment = await getPaymentDetails(paymentId)
      const status = String(rzpPayment.status)
      const amountNum =
        typeof rzpPayment.amount === 'number' ? rzpPayment.amount : Number(rzpPayment.amount)
      if ((status === 'captured' || status === 'authorized') && Number.isFinite(amountNum)) {
        capturedAmount = amountNum / 100
      } else {
        console.warn('[VERIFY] ⚠️ Payment not captured yet — status:', status)
      }
    } catch (rzpErr) {
      console.warn('[VERIFY] ⚠️ Could not fetch Razorpay payment details:', rzpErr)
    }

    if (capturedAmount === null) {
      await logSystemEvent({
        severity: 'warn',
        event_type: 'payment_not_captured',
        actor_type: 'user',
        actor_label: booking.user_email || booking.user_name,
        entity_type: 'booking',
        entity_id: booking.booking_id,
        message: 'Could not confirm Razorpay capture during verify; deferring to webhook/reconcile',
        metadata: { orderId, paymentId },
      })
      // Money is safe; tell the client we received it and are finalizing.
      return Response.json(
        {
          success: false,
          pending: true,
          error: 'Payment received — finalizing your booking. You will get a confirmation shortly.',
        },
        { status: 202 }
      )
    }
    console.log('[VERIFY] ✅ Captured amount:', capturedAmount)

    // ── STEP 5: Atomically record payment + confirm booking ───────────────────
    console.log('[VERIFY] STEP 5 — Recording payment atomically...')
    const invoiceNumber = generateInvoiceNumber()
    const { data: result, error: recordError } = await recordOnlinePaymentAtomic({
      bookingUuid: booking.id,
      txnId: paymentId,
      orderId,
      capturedAmount,
      invoice: invoiceNumber,
    })

    if (recordError || !result) {
      // FAIL-CLOSED: booking is NOT confirmed. Surface, log, let webhook/reconcile heal.
      console.error('[VERIFY] ❌ Atomic record failed:', recordError)
      await logSystemEvent({
        severity: 'error',
        event_type: 'payment_record_failed',
        actor_type: 'user',
        actor_label: booking.user_email || booking.user_name,
        entity_type: 'booking',
        entity_id: booking.booking_id,
        message: 'Failed to record captured payment in DB during verify',
        metadata: { orderId, paymentId, capturedAmount, error: String(recordError) },
      })
      return Response.json(
        {
          success: false,
          pending: true,
          error: 'Payment received — finalizing your booking. You will get a confirmation shortly.',
        },
        { status: 202 }
      )
    }
    console.log('[VERIFY] ✅ Payment recorded + booking confirmed:', result.payment_id)

    await logSystemEvent({
      severity: result.amount_mismatch ? 'warn' : 'info',
      event_type: result.amount_mismatch ? 'payment_amount_mismatch' : 'online_payment_confirmed',
      actor_type: 'user',
      actor_label: booking.user_email || booking.user_name,
      entity_type: 'booking',
      entity_id: booking.booking_id,
      message: result.amount_mismatch
        ? 'Online payment confirmed but captured amount differs from expected'
        : 'Online payment confirmed',
      metadata: { orderId, paymentId, capturedAmount, payment_id: result.payment_id },
    })

    // ── STEP 6: Send emails (non-blocking on failure) ─────────────────────────
    const userEmail: string = body.userEmail || booking.user_email || ''
    const userName: string = body.userName || booking.user_name || 'Customer'
    const amountPaid = capturedAmount
    const amountDue = Math.max(0, Number(booking.amount_total) - amountPaid)
    const resolvedPaymentMethod = capturedAmount >= Number(booking.amount_total) - 0.01 ? 'full' : 'partial'

    const pickupDate = body.pickupDate || (booking.start_datetime ? booking.start_datetime.split('T')[0] : '')
    const pickupTime = body.pickupTime || (booking.start_datetime
      ? new Date(booking.start_datetime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : '')
    const carType = body.carType || booking.car_model || 'Economy'
    const resolvedBookingType = bookingType || booking.booking_type || 'taxi'

    let destinationName = body.destination || body.tourPackageName || ''
    if (!destinationName) {
      if (booking.destination_id) {
        const { data: dest } = await supabaseAdmin.from('destinations').select('name').eq('id', booking.destination_id).single()
        destinationName = dest?.name || ''
      } else if (booking.tour_package_id) {
        const { data: tour } = await supabaseAdmin.from('tour_packages').select('name').eq('id', booking.tour_package_id).single()
        destinationName = tour?.name || ''
      }
    }

    if (userEmail) {
      const emailResults = await Promise.allSettled([
        sendBookingConfirmation({
          to: userEmail,
          bookingId: booking.booking_id,
          userName,
          bookingType: resolvedBookingType,
          destination: resolvedBookingType !== 'tour' ? destinationName : undefined,
          tourPackageName: resolvedBookingType === 'tour' ? destinationName : undefined,
          pickupDate,
          pickupTime,
          carType,
          totalAmount: booking.amount_total,
          amountPaid,
          amountDue,
          paymentMethod: resolvedPaymentMethod,
        }),
        sendAdminNotification({
          bookingId: booking.booking_id,
          userEmail,
          userName,
          totalAmount: booking.amount_total,
          bookingType: resolvedBookingType,
          destination: destinationName,
          pickupDate,
        }),
      ])
      emailResults.forEach((r, i) => {
        const label = i === 0 ? 'Customer confirmation' : 'Admin notification'
        if (r.status === 'rejected') console.error(`[VERIFY] ❌ ${label}:`, r.reason)
        else console.log(`[VERIFY] ✅ ${label} sent`)
      })
    } else {
      console.error('[VERIFY] ❌ Skipping emails — no userEmail')
    }

    console.log('[VERIFY] ══════════════════════════════════')

    return Response.json({
      success: true,
      message: 'Payment verified and recorded successfully',
      bookingId: booking.booking_id,
      paymentId: result.payment_id,
      invoiceNumber,
    })
  } catch (error) {
    console.error('[VERIFY] ❌ Unhandled error:', error)
    return Response.json({ success: false, error: 'Payment verification failed', details: String(error) }, { status: 500 })
  }
}
