import { verifyRazorpayPayment, getPaymentDetails } from '@/lib/payment'
import { sendBookingConfirmation, sendAdminNotification } from '@/lib/resend-notifications'
import { generateInvoiceNumber } from '@/lib/utils'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { calculatePaymentAmounts } from '@/lib/payment-utils'
import { getPaymentByBookingId, createPaymentInDB, createPaymentRecord } from '@/lib/payment-db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { orderId, paymentId, signature, bookingId, bookingType, paymentMethod, amount } = body

    // ── STEP 1: Log incoming payload ───────────────────────────────────────────
    console.log('[VERIFY] ══════════════════════════════════')
    console.log('[VERIFY] STEP 1 — Incoming payload:')
    console.log('[VERIFY]   bookingId:', bookingId)
    console.log('[VERIFY]   paymentId:', paymentId)
    console.log('[VERIFY]   orderId:', orderId)
    console.log('[VERIFY]   bookingType:', bookingType)
    console.log('[VERIFY]   paymentMethod:', paymentMethod)
    console.log('[VERIFY]   amount:', amount)
    console.log('[VERIFY]   key_secret set:', !!process.env.RAZORPAY_KEY_SECRET)

    // ── STEP 2: Verify Razorpay signature ─────────────────────────────────────
    console.log('[VERIFY] STEP 2 — Verifying Razorpay signature...')
    const isValidSignature = verifyRazorpayPayment(orderId, paymentId, signature)
    if (!isValidSignature) {
      console.error('[VERIFY] ❌ Invalid signature')
      console.error('[VERIFY]   orderId:', orderId)
      console.error('[VERIFY]   paymentId:', paymentId)
      return Response.json({ success: false, error: 'Invalid payment signature' }, { status: 400 })
    }
    console.log('[VERIFY] ✅ Signature valid')

    // ── STEP 3: Fetch booking (using actual schema column names) ───────────────
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
    console.log('[VERIFY] ✅ Booking found — amount_total:', booking.amount_total, '| booking_id:', booking.booking_id)

    // ── STEP 4: Resolve user email/name (directly from booking row) ───────────
    console.log('[VERIFY] STEP 4 — Resolving user email...')
    const userEmail: string = body.userEmail || booking.user_email || ''
    const userName: string = body.userName || booking.user_name || 'Customer'

    if (!userEmail) {
      console.error('[VERIFY] ❌ No user email — emails will be skipped')
    } else {
      console.log('[VERIFY] ✅ userEmail:', userEmail, '| userName:', userName)
    }

    // ── STEP 5: Fetch real payment details from Razorpay ──────────────────────
    console.log('[VERIFY] STEP 5 — Fetching payment details from Razorpay...')
    let rzpPaymentStatus = 'captured'
    let rzpAmountCaptured: number | null = null
    try {
      const rzpPayment = await getPaymentDetails(paymentId)
      rzpPaymentStatus = String(rzpPayment.status)
      rzpAmountCaptured = typeof rzpPayment.amount === 'number' ? rzpPayment.amount / 100 : null
      console.log('[VERIFY] ✅ Razorpay payment:', {
        id: rzpPayment.id,
        status: rzpPayment.status,
        method: (rzpPayment as any).method,
        amount: rzpPayment.amount,
      })
    } catch (rzpErr) {
      console.warn('[VERIFY] ⚠️ Could not fetch Razorpay payment details:', rzpErr)
    }

    // ── STEP 6: Create payment record ─────────────────────────────────────────
    console.log('[VERIFY] STEP 6 — Creating/checking payment record...')
    const { data: existingPayment } = await getPaymentByBookingId(booking.booking_id)
    let paymentRecord = existingPayment
    let storedInvoiceNumber: string | null = null

    if (!paymentRecord) {
      const { amountOnlinePaid } = calculatePaymentAmounts(booking.amount_total, paymentMethod)
      const confirmedOnlineAmount = rzpAmountCaptured !== null ? rzpAmountCaptured : amountOnlinePaid
      const txnStatus: 'success' | 'failed' = rzpPaymentStatus === 'captured' || rzpPaymentStatus === 'authorized' ? 'success' : 'failed'
      const { data: newPayment, error: paymentError } = await createPaymentInDB({
        booking_id: booking.booking_id,
        payment_type: paymentMethod,
        amount_total: booking.amount_total,
        amount_online_paid: confirmedOnlineAmount,
        amount_cash_paid: 0,
        txn_status: txnStatus,
        txn_id: paymentId,
        gateway: 'razorpay',
        payment_status: paymentMethod === 'full' ? 'paid' : 'partial',
      })
      if (paymentError) console.error('[VERIFY] ❌ Payment record error:', paymentError)
      else {
        paymentRecord = newPayment
        console.log('[VERIFY] ✅ Payment record created:', newPayment?.id)
        if (newPayment) {
          storedInvoiceNumber = generateInvoiceNumber()
          await createPaymentRecord({
            payment_id: newPayment.id,
            booking_id: booking.booking_id,
            txn_type: 'online',
            txn_id: paymentId,
            gateway: 'razorpay',
            amount: confirmedOnlineAmount,
            status: txnStatus,
            razorpay_order_id: orderId,
            invoice_number: storedInvoiceNumber,
          }).catch(err => console.error('[VERIFY] ❌ payment_record insert failed:', err))
        }
      }
    } else {
      console.log('[VERIFY] Payment record already exists:', existingPayment?.id)
    }

    // ── STEP 7: Confirm booking ────────────────────────────────────────────────
    console.log('[VERIFY] STEP 7 — Updating booking status to confirmed...')
    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({ booking_status: 'confirmed' })
      .eq('id', bookingId)
    if (updateError) console.error('[VERIFY] ❌ Status update error:', updateError)
    else console.log('[VERIFY] ✅ Booking confirmed')

    // ── STEP 8: Send emails ────────────────────────────────────────────────────
    console.log('[VERIFY] STEP 8 — Sending emails...')
    const amountPaid = paymentMethod === 'full' ? booking.amount_total : Math.round(booking.amount_total * 0.3)
    const amountDue = booking.amount_total - amountPaid

    // Extract pickup date and time from start_datetime
    const pickupDate = body.pickupDate || (booking.start_datetime ? booking.start_datetime.split('T')[0] : '')
    const pickupTime = body.pickupTime || (booking.start_datetime
      ? new Date(booking.start_datetime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : '')
    const carType = body.carType || booking.car_model || 'Economy'
    const resolvedBookingType = bookingType || booking.booking_type || 'taxi'

    // Resolve destination / tour name
    let destinationName = body.destination || body.tourPackageName || ''
    if (!destinationName) {
      if (booking.destination_id) {
        const { data: dest } = await supabaseAdmin.from('destinations').select('name').eq('id', booking.destination_id).single()
        destinationName = dest?.name || ''
      } else if (booking.tour_package_id) {
        const { data: tour } = await supabaseAdmin.from('tours').select('name').eq('id', booking.tour_package_id).single()
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
          paymentMethod,
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
      payment: paymentRecord,
      invoiceNumber: storedInvoiceNumber || generateInvoiceNumber(),
    })
  } catch (error) {
    console.error('[VERIFY] ❌ Unhandled error:', error)
    return Response.json({ success: false, error: 'Payment verification failed', details: String(error) }, { status: 500 })
  }
}
