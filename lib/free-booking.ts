import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Free ("pay later") booking rules.
 *
 * A free booking lets a customer submit a request without paying. It is
 * recorded as UNPAID, holds its vehicle for a limited window, and is settled
 * later in cash recorded by an admin. Everything here is admin-tunable from
 * app_settings so the Rina's team can adjust behaviour without a redeploy.
 */

export type FreeBookingSettings = {
  enabledTaxi: boolean
  enabledTour: boolean
  holdHoursTaxi: number
  holdHoursTour: number
  /** Minimum notice required to book for free. 0 = no restriction. */
  minLeadHours: number
  /** Max simultaneously open unpaid bookings per authenticated account. */
  maxOpenPerUser: number
  maxAdvanceDays: number
}

/**
 * Used when a settings row is missing or unreadable. These mirror the seeds in
 * sql/free_booking.sql, so a partially-seeded database still behaves sanely.
 */
const DEFAULTS: FreeBookingSettings = {
  enabledTaxi: true,
  enabledTour: true,
  holdHoursTaxi: 48,
  holdHoursTour: 24,
  minLeadHours: 0,
  maxOpenPerUser: 2,
  maxAdvanceDays: 90,
}

const SETTING_KEYS = [
  'free_booking_enabled_taxi',
  'free_booking_enabled_tour',
  'free_booking_hold_hours_taxi',
  'free_booking_hold_hours_tour',
  'free_booking_min_lead_hours',
  'free_booking_max_open_per_user',
  'free_booking_max_advance_days',
] as const

function toNumber(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export async function getFreeBookingSettings(): Promise<FreeBookingSettings> {
  const { data, error } = await supabaseAdmin
    .from('app_settings')
    .select('key, value')
    .in('key', [...SETTING_KEYS])

  if (error) {
    console.error('Failed to read free booking settings, using defaults:', error)
    return { ...DEFAULTS }
  }

  const s: Record<string, string> = {}
  for (const row of data ?? []) s[row.key] = row.value

  return {
    // Only an explicit 'false' disables the feature; anything else stays on.
    enabledTaxi: s['free_booking_enabled_taxi'] !== 'false',
    enabledTour: s['free_booking_enabled_tour'] !== 'false',
    holdHoursTaxi: toNumber(s['free_booking_hold_hours_taxi'], DEFAULTS.holdHoursTaxi),
    holdHoursTour: toNumber(s['free_booking_hold_hours_tour'], DEFAULTS.holdHoursTour),
    minLeadHours: toNumber(s['free_booking_min_lead_hours'], DEFAULTS.minLeadHours),
    maxOpenPerUser: toNumber(s['free_booking_max_open_per_user'], DEFAULTS.maxOpenPerUser),
    maxAdvanceDays: toNumber(s['free_booking_max_advance_days'], DEFAULTS.maxAdvanceDays),
  }
}

export function isFreeBookingEnabledFor(
  bookingType: string | null | undefined,
  settings: FreeBookingSettings
): boolean {
  return bookingType === 'tour' ? settings.enabledTour : settings.enabledTaxi
}

/**
 * Convert a booking's start_datetime into a real instant (epoch ms).
 *
 * bookings.start_datetime is TIMESTAMP WITHOUT TIME ZONE and holds IST
 * wall-clock time — createDateTimeIST writes "...+05:30" and Postgres discards
 * the offset on the way in. PostgREST therefore hands it back with no zone at
 * all ("2026-06-20T12:45:00"), so it must be re-anchored to IST to become a
 * comparable instant.
 *
 * Do NOT use toLocalTimeMs() from lib/conflicts for this. That helper reads the
 * wall clock as if it were UTC, which is fine for comparing bookings against
 * each other but is 5h30m off from a real instant like Date.now().
 */
export function istWallClockToInstantMs(value: string | null | undefined): number {
  if (!value) return NaN
  const normalized = String(value).trim().replace(' ', 'T')
  // Already carries a zone (offset or Z) — trust it as-is.
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized)) {
    return new Date(normalized).getTime()
  }
  return new Date(`${normalized}+05:30`).getTime()
}

/**
 * When an unpaid booking should stop holding its vehicle.
 *
 * Capped at the trip's own start time — holding a car beyond departure helps
 * nobody. A hold window of 0 yields an immediate expiry, which makes the
 * booking a pure enquiry that never blocks the fleet at all.
 */
export function computeHoldExpiry(input: {
  bookingType: string | null | undefined
  startDatetime: string | null | undefined
  settings: FreeBookingSettings
  now?: number
}): string {
  const { bookingType, startDatetime, settings } = input
  const now = input.now ?? Date.now()

  const holdHours = bookingType === 'tour' ? settings.holdHoursTour : settings.holdHoursTaxi
  const windowEnd = now + holdHours * 60 * 60 * 1000

  const startMs = istWallClockToInstantMs(startDatetime)
  const expiry = Number.isNaN(startMs) ? windowEnd : Math.min(windowEnd, startMs)

  return new Date(expiry).toISOString()
}
