/**
 * Payment Database Functions (SERVER-SIDE ONLY)
 * These functions use supabaseAdmin and should only be called from API routes
 */

import { supabaseAdmin } from './supabase-admin'
import { validatePaymentAmounts } from './payment-utils'

/**
 * Create a payment record in the database
 * @param paymentData - Payment data to insert
 * @returns Payment record or error
 */
export async function createPaymentInDB(paymentData: {
  booking_id: string
  payment_type: 'partial' | 'full'
  amount_total: number
  amount_online_paid: number
  amount_cash_paid?: number
  txn_status?: 'pending' | 'success' | 'failed'
  txn_id?: string
  gateway?: string
  payment_status?: 'pending' | 'partial' | 'paid'
}) {
  try {
    // Set default values
    const finalPaymentData = {
      booking_id: paymentData.booking_id,
      payment_type: paymentData.payment_type,
      amount_total: paymentData.amount_total,
      amount_online_paid: paymentData.amount_online_paid,
      amount_cash_paid: paymentData.amount_cash_paid || 0,
      txn_status: paymentData.txn_status || 'success',
      txn_id: paymentData.txn_id || null,
      gateway: paymentData.gateway || 'razorpay',
      payment_status: paymentData.payment_status || 'pending',
    }

    const { data, error } = await supabaseAdmin
      .from('payments')
      .insert([finalPaymentData])
      .select()
      .single()

    if (error) {
      console.error('Error creating payment record:', error)
      return { data: null, error }
    }

    return { data, error: null }
  } catch (err) {
    console.error('Exception creating payment record:', err)
    return { data: null, error: err }
  }
}

/**
 * Atomically record an online payment AND confirm its booking.
 *
 * Delegates to the `record_online_payment` Postgres function so the payments
 * row, the payment_records ledger row and the booking confirmation all commit
 * together (or not at all). Idempotent: safe to call from verify, the webhook
 * and reconciliation for the same payment.
 *
 * @param bookingUuid    bookings.id (the PK — what Razorpay order notes carry)
 * @param txnId          Razorpay payment id (pay_...)
 * @param orderId        Razorpay order id (order_...)
 * @param capturedAmount amount captured by Razorpay, in rupees
 * @param invoice        invoice number to stamp on the ledger row
 */
export async function recordOnlinePaymentAtomic(args: {
  bookingUuid: string
  txnId: string
  orderId?: string | null
  capturedAmount: number
  invoice?: string | null
}): Promise<{
  data: { payment_id: string; was_created: boolean; amount_mismatch: boolean } | null
  error: unknown
}> {
  try {
    const { data, error } = await supabaseAdmin.rpc('record_online_payment', {
      p_booking_uuid: args.bookingUuid,
      p_txn_id: args.txnId,
      p_order_id: args.orderId ?? null,
      p_captured_amount: args.capturedAmount,
      p_invoice: args.invoice ?? null,
    })

    if (error) {
      console.error('record_online_payment RPC error:', error)
      return { data: null, error }
    }

    // The function returns a single-row table; supabase surfaces it as an array.
    const row = Array.isArray(data) ? data[0] : data
    return { data: row ?? null, error: null }
  } catch (err) {
    console.error('Exception in recordOnlinePaymentAtomic:', err)
    return { data: null, error: err }
  }
}

/**
 * Get payment record by booking ID
 * @param bookingId - Booking ID
 * @returns Payment record or null
 */
export async function getPaymentByBookingId(bookingId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('booking_id', bookingId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found - not an error
        return { data: null, error: null }
      }
      console.error('Error fetching payment:', error)
      return { data: null, error }
    }

    return { data, error: null }
  } catch (err) {
    console.error('Exception fetching payment:', err)
    return { data: null, error: err }
  }
}

/**
 * Update payment status
 * @param bookingId - Booking ID
 * @param paymentStatus - New payment status
 * @returns Updated payment record or error
 */
export async function updatePaymentStatus(
  bookingId: string,
  paymentStatus: 'pending' | 'partial' | 'paid'
) {
  try {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .update({ payment_status: paymentStatus })
      .eq('booking_id', bookingId)
      .select()
      .single()

    if (error) {
      console.error('Error updating payment status:', error)
      return { data: null, error }
    }

    return { data, error: null }
  } catch (err) {
    console.error('Exception updating payment status:', err)
    return { data: null, error: err }
  }
}

/**
 * Create a payment_records row for a single transaction (online or cash)
 */
export async function createPaymentRecord(data: {
  payment_id: string
  booking_id: string
  txn_type: 'online' | 'cash'
  txn_id?: string | null
  gateway?: string | null
  amount: number
  currency?: string
  status?: 'success' | 'failed' | 'pending'
  razorpay_order_id?: string | null
  collected_by?: string | null
  collected_at?: string | null
  invoice_number?: string | null
  notes?: string | null
}) {
  try {
    const { data: record, error } = await supabaseAdmin
      .from('payment_records')
      .insert([{
        payment_id: data.payment_id,
        booking_id: data.booking_id,
        txn_type: data.txn_type,
        txn_id: data.txn_id ?? null,
        gateway: data.gateway ?? null,
        amount: data.amount,
        currency: data.currency ?? 'INR',
        status: data.status ?? 'success',
        razorpay_order_id: data.razorpay_order_id ?? null,
        collected_by: data.collected_by ?? null,
        collected_at: data.collected_at ?? null,
        invoice_number: data.invoice_number ?? null,
        notes: data.notes ?? null,
      }])
      .select()
      .single()
    if (error) {
      console.error('Error creating payment_record:', error)
      return { data: null, error }
    }
    return { data: record, error: null }
  } catch (err) {
    console.error('Exception creating payment_record:', err)
    return { data: null, error: err }
  }
}

/**
 * Get all payment_records for a given payments.id
 */
export async function getPaymentRecordsByPaymentId(paymentId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('payment_records')
      .select('*')
      .eq('payment_id', paymentId)
      .order('created_at', { ascending: true })
    if (error) {
      console.error('Error fetching payment_records:', error)
      return { data: null, error }
    }
    return { data: data || [], error: null }
  } catch (err) {
    console.error('Exception fetching payment_records:', err)
    return { data: null, error: err }
  }
}

/**
 * Mark cash payment as collected
 * @param bookingId - Booking ID
 * @param amountCashPaid - Cash amount collected
 * @param collectedBy - Admin/staff who collected the cash
 * @returns Updated payment record or error
 */
export async function markCashPaymentCollected(
  bookingId: string,
  amountCashPaid: number,
  collectedBy: string
) {
  try {
    const now = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('payments')
      .update({
        amount_cash_paid: amountCashPaid,
        cash_paid_at: now,
        cash_collected_by: collectedBy,
        payment_status: 'paid',
      })
      .eq('booking_id', bookingId)
      .select()
      .single()

    if (error) {
      console.error('Error updating cash payment:', error)
      return { data: null, error }
    }

    return { data, error: null }
  } catch (err) {
    console.error('Exception updating cash payment:', err)
    return { data: null, error: err }
  }
}
