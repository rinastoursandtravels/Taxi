import Razorpay from 'razorpay'
import crypto from 'crypto'

function getRazorpay() {
  return new Razorpay({
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || '',
  })
}

export async function createRazorpayOrder(amount: number, bookingId: string) {
  try {
    const order = await getRazorpay().orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `bk_${bookingId.replace(/-/g, '').slice(0, 37)}`,
      payment_capture: true,
      notes: { booking_id: bookingId },
    })
    return order
  } catch (error) {
    console.error('Razorpay Order Creation Error:', error)
    throw error
  }
}

export function verifyRazorpayPayment(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const key_secret = process.env.RAZORPAY_KEY_SECRET || ''
  const body = orderId + '|' + paymentId
  const expectedSignature = crypto.createHmac('sha256', key_secret).update(body).digest('hex')
  return expectedSignature === signature
}

/**
 * Verify an inbound Razorpay webhook signature.
 * Razorpay signs the *raw* request body with the webhook secret (HMAC-SHA256).
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || ''
  if (!secret || !signature) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  // timing-safe compare; lengths must match first
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/**
 * List payments for a time window (used by reconciliation).
 * @param from - unix seconds (inclusive)
 * @param to   - unix seconds (inclusive)
 */
export async function listRazorpayPayments(params: {
  from: number
  to: number
  count?: number
  skip?: number
}) {
  try {
    return await getRazorpay().payments.all({
      from: params.from,
      to: params.to,
      count: params.count ?? 100,
      skip: params.skip ?? 0,
    })
  } catch (error) {
    console.error('Razorpay Payments List Error:', error)
    throw error
  }
}

/**
 * Fetch an order (used to read notes.booking_id when reconciling).
 */
export async function getOrderDetails(orderId: string) {
  try {
    return await getRazorpay().orders.fetch(orderId)
  } catch (error) {
    console.error('Razorpay Order Fetch Error:', error)
    throw error
  }
}

export async function getPaymentDetails(paymentId: string) {
  try {
    const payment = await getRazorpay().payments.fetch(paymentId)
    return payment
  } catch (error) {
    console.error('Razorpay Payment Fetch Error:', error)
    throw error
  }
}

export async function refundPayment(paymentId: string, amount?: number) {
  try {
    const refund = await getRazorpay().payments.refund(paymentId, {
      amount: amount ? Math.round(amount * 100) : undefined,
    })
    return refund
  } catch (error) {
    console.error('Razorpay Refund Error:', error)
    throw error
  }
}
