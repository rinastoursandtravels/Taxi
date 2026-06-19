import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest, requireAdminRequest } from '@/lib/admin-auth'
import { reconcileCapturedPayments, getReconcileWindowDays } from '@/lib/reconcile'
import { logSystemEvent } from '@/lib/system-events'

export const dynamic = 'force-dynamic'

// GET — called by Vercel Cron (requires CRON_SECRET)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const summary = await reconcileCapturedPayments(await getReconcileWindowDays())
    await logSystemEvent({
      severity: summary.healed > 0 ? 'warn' : 'info',
      event_type: 'reconcile_cron_completed',
      actor_type: 'job',
      message: `Payment reconciliation completed (healed ${summary.healed})`,
      metadata: summary as any,
    })
    return NextResponse.json({ success: true, ...summary })
  } catch (error) {
    console.error('[RECONCILE] cron error:', error)
    await logSystemEvent({
      severity: 'error',
      event_type: 'reconcile_cron_failed',
      actor_type: 'job',
      message: 'Payment reconciliation failed',
      metadata: { error: error instanceof Error ? error.message : String(error) },
    })
    return NextResponse.json({ success: false, error: 'Reconciliation failed' }, { status: 500 })
  }
}

// POST — manual "Reconcile Now" from the admin panel
export async function POST(request: NextRequest) {
  const unauthorized = requireAdminRequest(request)
  if (unauthorized) return unauthorized
  const admin = getAdminFromRequest(request)
  try {
    const url = new URL(request.url)
    const days = parseFloat(url.searchParams.get('days') || '') || (await getReconcileWindowDays())
    const summary = await reconcileCapturedPayments(days)
    await logSystemEvent({
      severity: summary.healed > 0 ? 'warn' : 'info',
      event_type: 'reconcile_manual_completed',
      actor_type: 'admin',
      actor_id: admin?.id || null,
      actor_label: admin?.email || null,
      message: `Manual payment reconciliation completed (healed ${summary.healed})`,
      metadata: summary as any,
    })
    return NextResponse.json({ success: true, ...summary })
  } catch (error) {
    console.error('[RECONCILE] manual error:', error)
    return NextResponse.json({ success: false, error: 'Reconciliation failed' }, { status: 500 })
  }
}
