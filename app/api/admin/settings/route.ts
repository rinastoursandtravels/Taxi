import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminRequest } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// Keys the customer-facing pages may read without admin auth. The free booking
// switches are here because the checkout screen has to know whether to offer
// the "Book Now, Pay Later" option — the server re-checks them on submit, so
// exposing them reveals nothing an attacker could exploit.
const PUBLIC_READ_KEYS = new Set([
  'pending_booking_timeout_hours',
  'free_booking_enabled_taxi',
  'free_booking_enabled_tour',
  // Hold-window lengths, so the payment page can tell a customer up front how
  // long they have to pay before their free booking's vehicle hold lapses.
  'free_booking_hold_hours_taxi',
  'free_booking_hold_hours_tour',
])

export async function GET(request: NextRequest) {
  try {
    const key = request.nextUrl.searchParams.get('key')
    if (!key || !PUBLIC_READ_KEYS.has(key)) {
      const unauthorized = requireAdminRequest(request)
      if (unauthorized) return unauthorized
    }

    const query = supabaseAdmin.from('app_settings').select('key, value, updated_at')
    if (key) query.eq('key', key)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ success: true, settings: data })
  } catch (error) {
    console.error('Settings GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const unauthorized = requireAdminRequest(request)
  if (unauthorized) return unauthorized

  try {
    const { key, value } = await request.json()
    if (!key || value === undefined) {
      return NextResponse.json({ success: false, error: 'Missing key or value' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .upsert({ key, value: String(value), updated_at: new Date().toISOString() }, { onConflict: 'key' })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, setting: data })
  } catch (error) {
    console.error('Settings PATCH error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update setting' }, { status: 500 })
  }
}
