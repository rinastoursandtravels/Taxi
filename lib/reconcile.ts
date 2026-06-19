/**
 * Payment reconciliation core (SERVER-SIDE ONLY).
 *
 * Scans captured Razorpay payments in a time window and auto-heals any that have
 * no matching DB record, using the same idempotent RPC as verify/webhook. Shared
 * by /api/admin/reconcile-payments and the cleanup cron's heal-before-delete pass.
 */
import { supabaseAdmin } from './supabase-admin'
import { listRazorpayPayments, getOrderDetails } from './payment'
import { recordOnlinePaymentAtomic } from './payment-db'
import { generateInvoiceNumber } from './utils'
import { logSystemEvent } from './system-events'

export type ReconcileSummary = {
  scanned: number
  healed: number
  alreadyRecorded: number
  skippedRefunded: number
  unresolved: number
  errors: number
  confirmedWithoutPayment: number
  healedDetails: Array<{ paymentId: string; bookingUuid: string; amount: number }>
}

async function resolveBookingUuid(payment: any): Promise<string | undefined> {
  if (payment?.notes?.booking_id) return payment.notes.booking_id
  if (payment?.order_id) {
    try {
      const order: any = await getOrderDetails(payment.order_id)
      return order?.notes?.booking_id
    } catch {
      return undefined
    }
  }
  return undefined
}

export async function reconcileCapturedPayments(windowDays: number): Promise<ReconcileSummary> {
  const to = Math.floor(Date.now() / 1000)
  const from = to - Math.round(windowDays * 24 * 60 * 60)

  const summary: ReconcileSummary = {
    scanned: 0,
    healed: 0,
    alreadyRecorded: 0,
    skippedRefunded: 0,
    unresolved: 0,
    errors: 0,
    confirmedWithoutPayment: 0,
    healedDetails: [],
  }

  let skip = 0
  const count = 100
  // Razorpay caps a single fetch at 100; loop until a short page is returned.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page: any = await listRazorpayPayments({ from, to, count, skip })
    const items: any[] = page?.items || []
    if (items.length === 0) break

    for (const p of items) {
      if (String(p.status) !== 'captured') continue
      summary.scanned++

      const amount = Number(p.amount) / 100
      const amountRefunded = Number(p.amount_refunded || 0) / 100
      if (p.refund_status === 'full' || amountRefunded >= amount) {
        summary.skippedRefunded++
        continue
      }

      // Already recorded? (payment_records.txn_id is unique)
      const { data: existing } = await supabaseAdmin
        .from('payment_records')
        .select('id')
        .eq('txn_id', p.id)
        .limit(1)
      if (existing && existing.length > 0) {
        summary.alreadyRecorded++
        continue
      }

      const bookingUuid = await resolveBookingUuid(p)
      if (!bookingUuid) {
        summary.unresolved++
        await logSystemEvent({
          severity: 'warn',
          event_type: 'reconcile_booking_unresolved',
          actor_type: 'job',
          message: 'Reconcile found a captured payment with no resolvable booking',
          metadata: { paymentId: p.id, orderId: p.order_id, amount },
        })
        continue
      }

      const { data: result, error } = await recordOnlinePaymentAtomic({
        bookingUuid,
        txnId: p.id,
        orderId: p.order_id,
        capturedAmount: amount,
        invoice: generateInvoiceNumber(),
      })

      if (error || !result) {
        summary.errors++
        await logSystemEvent({
          severity: 'error',
          event_type: 'reconcile_heal_failed',
          actor_type: 'job',
          entity_type: 'booking',
          entity_id: bookingUuid,
          message: 'Reconcile failed to heal an orphan payment',
          metadata: { paymentId: p.id, orderId: p.order_id, amount, error: String(error) },
        })
        continue
      }

      summary.healed++
      summary.healedDetails.push({ paymentId: p.id, bookingUuid, amount })
      await logSystemEvent({
        severity: 'info',
        event_type: 'payment_reconciled_healed',
        actor_type: 'job',
        entity_type: 'booking',
        entity_id: bookingUuid,
        message: 'Reconcile healed an orphan captured payment',
        metadata: { paymentId: p.id, orderId: p.order_id, amount, payment_id: result.payment_id },
      })
    }

    if (items.length < count) break
    skip += count
  }

  // Inverse anomaly (report only): bookings confirmed but with no payment row.
  const { data: confirmed } = await supabaseAdmin
    .from('bookings')
    .select('booking_id')
    .eq('booking_status', 'confirmed')
  if (confirmed && confirmed.length > 0) {
    const ids = confirmed.map((b: any) => b.booking_id)
    const { data: paid } = await supabaseAdmin
      .from('payments')
      .select('booking_id')
      .in('booking_id', ids)
    const paidSet = new Set((paid || []).map((p: any) => p.booking_id))
    summary.confirmedWithoutPayment = ids.filter((id: string) => !paidSet.has(id)).length
    if (summary.confirmedWithoutPayment > 0) {
      await logSystemEvent({
        severity: 'warn',
        event_type: 'reconcile_confirmed_without_payment',
        actor_type: 'job',
        message: 'Confirmed bookings exist with no payment row',
        metadata: { count: summary.confirmedWithoutPayment },
      })
    }
  }

  return summary
}

export async function getReconcileWindowDays(): Promise<number> {
  const { data } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', 'reconcile_window_days')
    .maybeSingle()
  const v = parseFloat(String(data?.value ?? '3'))
  return Number.isFinite(v) && v > 0 ? v : 3
}
