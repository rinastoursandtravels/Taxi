import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature, getOrderDetails } from '@/lib/payment'
import { recordOnlinePaymentAtomic } from '@/lib/payment-db'
import { generateInvoiceNumber } from '@/lib/utils'
import { logSystemEvent } from '@/lib/system-events'

export const dynamic = 'force-dynamic'

/**
 * Razorpay webhook — the server-to-server safety net.
 *
 * Fires even if the customer's browser closes before /api/payment/verify runs,
 * so a captured payment is ALWAYS recorded and its booking confirmed. Calls the
 * same idempotent RPC as verify, so duplicate delivery is harmless.
 *
 * Configure in Razorpay dashboard with events: payment.captured, order.paid.
 */
export async function POST(request: NextRequest) {
  // Razorpay signs the raw body — read it before parsing.
  const rawBody = await request.text()
  const signature = request.headers.get('x-razorpay-signature') || ''

  if (!verifyWebhookSignature(rawBody, signature)) {
    await logSystemEvent({
      severity: 'security',
      event_type: 'webhook_signature_invalid',
      actor_type: 'system',
      message: 'Razorpay webhook signature verification failed',
    })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const event: string = body?.event || ''
  const paymentEntity = body?.payload?.payment?.entity
  const orderEntity = body?.payload?.order?.entity

  // Only act on captured-money events; ack everything else so Razorpay stops.
  if (event !== 'payment.captured' && event !== 'order.paid') {
    return NextResponse.json({ received: true, ignored: event }, { status: 200 })
  }

  try {
    if (!paymentEntity || String(paymentEntity.status) !== 'captured') {
      return NextResponse.json({ received: true, ignored: 'no captured payment' }, { status: 200 })
    }

    const paymentId: string = paymentEntity.id
    const orderId: string | undefined = paymentEntity.order_id || orderEntity?.id
    const capturedAmount = Number(paymentEntity.amount) / 100

    // booking_id (the bookings.id PK) lives in the ORDER notes for this app.
    let bookingUuid: string | undefined =
      paymentEntity.notes?.booking_id || orderEntity?.notes?.booking_id
    if (!bookingUuid && orderId) {
      try {
        const order: any = await getOrderDetails(orderId)
        bookingUuid = order?.notes?.booking_id
      } catch {
        /* fall through to the not-found branch below */
      }
    }

    if (!bookingUuid) {
      await logSystemEvent({
        severity: 'warn',
        event_type: 'webhook_booking_unresolved',
        actor_type: 'system',
        message: 'Webhook payment could not be mapped to a booking',
        metadata: { event, paymentId, orderId },
      })
      // Ack so Razorpay doesn't retry forever; reconciliation can still flag it.
      return NextResponse.json({ received: true, unresolved: true }, { status: 200 })
    }

    const { data: result, error } = await recordOnlinePaymentAtomic({
      bookingUuid,
      txnId: paymentId,
      orderId,
      capturedAmount,
      invoice: generateInvoiceNumber(),
    })

    if (error || !result) {
      await logSystemEvent({
        severity: 'error',
        event_type: 'webhook_record_failed',
        actor_type: 'system',
        entity_type: 'booking',
        entity_id: bookingUuid,
        message: 'Webhook failed to record captured payment',
        metadata: { event, paymentId, orderId, capturedAmount, error: String(error) },
      })
      // 500 → Razorpay will retry the webhook later.
      return NextResponse.json({ error: 'record failed' }, { status: 500 })
    }

    await logSystemEvent({
      severity: 'info',
      event_type: 'webhook_payment_recorded',
      actor_type: 'system',
      entity_type: 'booking',
      entity_id: bookingUuid,
      message: result.was_created
        ? 'Payment recorded via webhook'
        : 'Webhook re-confirmed already-recorded payment',
      metadata: { event, paymentId, orderId, capturedAmount, was_created: result.was_created },
    })

    return NextResponse.json({ received: true, recorded: true }, { status: 200 })
  } catch (err) {
    console.error('[WEBHOOK] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
