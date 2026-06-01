import { supabaseAdmin } from '@/lib/supabase-admin'
import { calculatePaymentAmounts, validatePaymentAmounts } from '@/lib/payment-utils'
import { createPaymentInDB, getPaymentByBookingId, createPaymentRecord } from '@/lib/payment-db'
import { sendBookingConfirmation, sendAdminNotification } from '@/lib/resend-notifications'
import { generateInvoiceNumber } from '@/lib/utils'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      bookingId,
      paymentType,
      amountTotal,
      amountOnlinePaid,
      txnId,
      txnStatus = 'success',
      gateway = 'razorpay',
    } = body

    console.log('=== Create Payment Request ===')
    console.log('Booking ID:', bookingId)
    console.log('Payment Type:', paymentType)
    console.log('Amount Total:', amountTotal)
    console.log('Amount Online Paid:', amountOnlinePaid)

    // ===== VALIDATION =====
    
    // Required fields validation
    if (!bookingId || !paymentType || amountTotal === undefined || amountOnlinePaid === undefined) {
      return Response.json(
        {
          success: false,
          error: 'Missing required fields: bookingId, paymentType, amountTotal, amountOnlinePaid',
        },
        { status: 400 }
      )
    }

    // Payment type validation
    if (!['partial', 'full'].includes(paymentType)) {
      return Response.json(
        {
          success: false,
          error: `Invalid payment_type. Must be 'partial' or 'full', received: ${paymentType}`,
        },
        { status: 400 }
      )
    }

    // Amount validation
    const parsedAmountTotal = parseFloat(String(amountTotal))
    const parsedAmountOnline = parseFloat(String(amountOnlinePaid))

    if (isNaN(parsedAmountTotal) || parsedAmountTotal <= 0) {
      return Response.json(
        {
          success: false,
          error: `Invalid amount_total. Must be a positive number, received: ${amountTotal}`,
        },
        { status: 400 }
      )
    }

    if (isNaN(parsedAmountOnline) || parsedAmountOnline < 0) {
      return Response.json(
        {
          success: false,
          error: `Invalid amount_online_paid. Must be non-negative, received: ${amountOnlinePaid}`,
        },
        { status: 400 }
      )
    }

    // Validate payment amounts based on payment type
    if (!validatePaymentAmounts(paymentType, parsedAmountTotal, parsedAmountOnline)) {
      const { amountOnlinePaid: expectedOnline } = calculatePaymentAmounts(parsedAmountTotal, paymentType)
      return Response.json(
        {
          success: false,
          error: `Invalid payment amounts for ${paymentType} payment. Expected online payment: ₹${expectedOnline.toFixed(2)}, received: ₹${parsedAmountOnline.toFixed(2)}`,
        },
        { status: 400 }
      )
    }

    // ===== BOOKING VALIDATION =====
    
    // Check if booking exists (bookingId is the database UUID 'id' field)
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, booking_id, booking_status, amount_total, booking_type, user_name, user_email, start_datetime, car_model, destination_id, tour_package_id')
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      console.error('Booking not found:', bookingError)
      return Response.json(
        {
          success: false,
          error: `Booking not found with ID: ${bookingId}`,
        },
        { status: 404 }
      )
    }

    console.log('Booking found:', booking)

    // ===== DUPLICATE PREVENTION =====
    
    // Check if payment record already exists for this booking
    const { data: existingPayment, error: existingError } = await getPaymentByBookingId(bookingId)

    if (existingError) {
      console.error('Error checking existing payment:', existingError)
    }

    if (existingPayment) {
      console.warn('Payment record already exists for this booking')
      return Response.json(
        {
          success: false,
          error: 'Payment already recorded for this booking. Cannot create duplicate payment record.',
        },
        { status: 409 }
      )
    }

    // ===== CREATE PAYMENT RECORD =====
    
    const { amountOnlinePaid: finalOnlineAmount, amountCashPaid: finalCashAmount } = calculatePaymentAmounts(
      parsedAmountTotal,
      paymentType
    )

    // Determine payment status based on transaction status
    let paymentStatus: 'pending' | 'partial' | 'paid' = 'pending'
    if (txnStatus === 'success') {
      if (paymentType === 'full') {
        paymentStatus = 'paid' // Full payment is complete
      } else {
        paymentStatus = 'partial' // 30% paid online
      }
    }

    const paymentRecord = {
      booking_id: booking.booking_id,
      payment_type: paymentType,
      amount_total: parsedAmountTotal,
      amount_online_paid: finalOnlineAmount,
      amount_cash_paid: finalCashAmount === parsedAmountTotal ? finalCashAmount : 0,
      txn_status: txnStatus,
      txn_id: txnId || null,
      gateway: gateway,
      payment_status: paymentStatus,
    }

    console.log('Creating payment record:', paymentRecord)

    const { data: payment, error: paymentError } = await createPaymentInDB(paymentRecord)

    if (paymentError || !payment) {
      console.error('Error creating payment record:', paymentError)
      return Response.json(
        {
          success: false,
          error: 'Failed to create payment record in database',
          details: paymentError,
        },
        { status: 500 }
      )
    }

    console.log('Payment record created successfully:', payment)

    // Create payment_records row for this online transaction
    const invoiceNumber = generateInvoiceNumber()
    await createPaymentRecord({
      payment_id: payment.id,
      booking_id: booking.booking_id,
      txn_type: 'online',
      txn_id: txnId || null,
      gateway: gateway,
      amount: finalOnlineAmount,
      status: txnStatus === 'success' ? 'success' : 'failed',
      invoice_number: invoiceNumber,
    }).catch(err => console.error('[CREATE-PAYMENT] payment_record insert failed:', err))

    // ===== UPDATE BOOKING STATUS =====
    
    // Update booking status to 'confirmed' after successful online payment
    if (txnStatus === 'success') {
      const { error: updateError } = await supabaseAdmin
        .from('bookings')
        .update({ booking_status: 'confirmed' })
        .eq('id', bookingId)

      if (updateError) {
        console.error('Error updating booking status:', updateError)
        // Don't fail the response, as payment record is already created
      } else {
        console.log(`Booking ${bookingId} status updated to 'confirmed'`)
      }
    }

    // ===== SEND CONFIRMATION EMAILS =====

    if (txnStatus === 'success' && booking.user_email) {
      console.log('[EMAIL] Sending confirmation to:', booking.user_email)

      // Resolve destination / tour name from DB
      let destinationName = ''
      if (booking.destination_id) {
        const { data: dest } = await supabaseAdmin
          .from('destinations')
          .select('name')
          .eq('id', booking.destination_id)
          .single()
        destinationName = dest?.name || ''
      } else if (booking.tour_package_id) {
        const { data: tour } = await supabaseAdmin
          .from('tour_packages')
          .select('name')
          .eq('id', booking.tour_package_id)
          .single()
        destinationName = tour?.name || ''
      }

      const amountPaid = paymentType === 'full' ? parsedAmountTotal : finalOnlineAmount
      const amountDue = parsedAmountTotal - amountPaid
      const pickupDate = booking.start_datetime ? booking.start_datetime.split('T')[0] : ''
      const pickupTime = booking.start_datetime
        ? new Date(booking.start_datetime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        : ''

      const emailResults = await Promise.allSettled([
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
          totalAmount: parsedAmountTotal,
          amountPaid,
          amountDue,
          paymentMethod: paymentType,
        }),
        sendAdminNotification({
          bookingId: booking.booking_id,
          userEmail: booking.user_email,
          userName: booking.user_name || 'Customer',
          totalAmount: parsedAmountTotal,
          bookingType: booking.booking_type || 'taxi',
          destination: destinationName,
          pickupDate,
        }),
      ])

      emailResults.forEach((r, i) => {
        const label = i === 0 ? 'Customer confirmation' : 'Admin notification'
        if (r.status === 'rejected') console.error(`[EMAIL] ❌ ${label} failed:`, r.reason)
        else console.log(`[EMAIL] ✅ ${label}:`, JSON.stringify(r.value))
      })
    } else if (txnStatus === 'success' && !booking.user_email) {
      console.warn('[EMAIL] ⚠️ No user_email on booking — skipping confirmation email')
    }

    // ===== SUCCESS RESPONSE =====

    return Response.json(
      {
        success: true,
        message: 'Payment created successfully',
        payment: {
          id: payment.id,
          booking_id: payment.booking_id,
          payment_type: payment.payment_type,
          amount_total: payment.amount_total,
          amount_online_paid: payment.amount_online_paid,
          amount_cash_paid: payment.amount_cash_paid,
          txn_status: payment.txn_status,
          payment_status: payment.payment_status,
        },
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
