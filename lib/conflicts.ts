import { supabaseAdmin } from '@/lib/supabase-admin'

export const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed'] as const

type ActiveBookingStatus = (typeof ACTIVE_BOOKING_STATUSES)[number]

export type ConflictBooking = {
  id?: string
  booking_id: string
  user_name?: string | null
  user_email?: string | null
  phone?: string | null
  car_model: string | null
  booking_type?: string | null
  start_datetime: string
  end_datetime: string
  booking_status: ActiveBookingStatus | string
  passenger_count?: number | null
  created_at?: string | null
  /** TIMESTAMPTZ — read isVehicleHoldActive before comparing this to anything. */
  hold_expires_at?: string | null
}

export type ConflictAssignment = {
  id: string
  booking_id: string
  car_id: string | null
  start_datetime: string
  end_datetime: string
  assigned_at?: string | null
  created_at?: string | null
}

export type ConflictCar = {
  id: string
  model_name: string
  class?: string | null
  number_plate?: string | null
  capacity?: number | null
  driver_name?: string | null
  driver_phone?: string | null
  driver_email?: string | null
  is_active?: boolean | null
}

export type ConflictWindow = {
  start: string
  end: string
}

export type ModelAvailability = {
  model_name: string
  class: string
  capacity: number
  total_count: number
  assigned_count: number
  unassigned_count: number
  blocked_count: number
  available_count: number
  raw_available_count: number
}

type FleetState = {
  activeBookings: ConflictBooking[]
  assignments: ConflictAssignment[]
  activeCars: ConflictCar[]
}

function bookingKey(booking: Pick<ConflictBooking, 'id' | 'booking_id'>): string {
  return booking.booking_id || booking.id || ''
}

function keyMatches(key: string | null | undefined, bookingOrKey: string | null | undefined): boolean {
  return Boolean(key && bookingOrKey && key === bookingOrKey)
}

export function toLocalTimeMs(value: string | null | undefined): number {
  if (!value) return NaN

  const match = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/
  )

  if (!match) {
    const parsed = new Date(value).getTime()
    return Number.isNaN(parsed) ? NaN : parsed
  }

  const [, year, month, day, hour = '0', minute = '0', second = '0'] = match
  return Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    0
  )
}

/**
 * Whether a booking still holds its vehicle against other customers.
 *
 * A free ("pay later") booking reserves its car only for a limited window, so
 * an unpaid request cannot lock up the fleet indefinitely. Once that window
 * lapses the car becomes bookable by others, while the booking row itself
 * survives untouched for the Rina's team to follow up on.
 *
 * IMPORTANT: hold_expires_at is a TIMESTAMPTZ — a real instant — unlike
 * start_datetime / end_datetime, which are naive IST wall-clock strings. Parse
 * it with `new Date()`, never with toLocalTimeMs() above.
 *
 * toLocalTimeMs discards the offset and reads the wall clock as UTC. That is
 * harmless while Postgres serialises timestamptz as UTC ("...+00:00"), which is
 * the Supabase default, so both parsers agree today. It stops being harmless
 * the moment the database timezone is set to Asia/Kolkata: values then arrive
 * as "...+05:30" and toLocalTimeMs reads them 5h30m late, quietly extending
 * every vehicle hold. `new Date()` is correct under either configuration.
 */
export function isVehicleHoldActive(
  booking: Pick<ConflictBooking, 'booking_status' | 'hold_expires_at'>,
  now: number = Date.now()
): boolean {
  // A confirmed booking is paid for and holds its vehicle unconditionally.
  if (booking.booking_status === 'confirmed') return true

  // No expiry set — every booking made before free booking existed, plus any
  // online checkout still in progress. Holds indefinitely, as it always has.
  if (!booking.hold_expires_at) return true

  const expiresAt = new Date(booking.hold_expires_at).getTime()

  // Unparseable value: keep holding. Failing safe means a customer might keep a
  // car slightly too long, never that a real booking silently loses its vehicle.
  if (Number.isNaN(expiresAt)) return true

  return expiresAt > now
}

function formatLocalMsWithISTOffset(ms: number): string {
  const d = new Date(ms)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+05:30`
}

export function createDateTimeIST(dateStr: string, timeStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(timeStr)) {
    throw new Error('Invalid date or time format')
  }

  const [year, month, day] = dateStr.split('-').map(Number)
  const [hour, minute] = timeStr.split(':').map(Number)
  const normalizedDate = new Date(Date.UTC(year, month - 1, day))

  if (
    normalizedDate.getUTCFullYear() !== year ||
    normalizedDate.getUTCMonth() !== month - 1 ||
    normalizedDate.getUTCDate() !== day ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error('Invalid date or time value')
  }

  return `${dateStr}T${timeStr}:00+05:30`
}

export function addMinutesToISTDateTime(startDateTime: string, minutes: number): string {
  const startMs = toLocalTimeMs(startDateTime)
  if (Number.isNaN(startMs)) throw new Error('Invalid start_datetime format')
  return formatLocalMsWithISTOffset(startMs + minutes * 60000)
}

export function windowsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const aStartMs = toLocalTimeMs(aStart)
  const aEndMs = toLocalTimeMs(aEnd)
  const bStartMs = toLocalTimeMs(bStart)
  const bEndMs = toLocalTimeMs(bEnd)

  if ([aStartMs, aEndMs, bStartMs, bEndMs].some(Number.isNaN)) return false
  return aStartMs < bEndMs && aEndMs > bStartMs
}

function overlapWindow(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const start = toLocalTimeMs(aStart) > toLocalTimeMs(bStart) ? aStart : bStart
  const end = toLocalTimeMs(aEnd) < toLocalTimeMs(bEnd) ? aEnd : bEnd
  return { start, end }
}

export async function getConflictControlEnabled(): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', 'conflict_control_enabled')
    .maybeSingle()

  if (error) {
    console.error('Failed to read conflict control setting:', error)
    return true
  }

  return data?.value !== 'false'
}

async function loadFleetState(): Promise<FleetState> {
  const [bookingsResult, assignmentsResult, carsResult] = await Promise.all([
    supabaseAdmin
      .from('bookings')
      .select('id, booking_id, user_name, user_email, phone, car_model, booking_type, start_datetime, end_datetime, booking_status, passenger_count, created_at, hold_expires_at')
      .in('booking_status', [...ACTIVE_BOOKING_STATUSES]),
    supabaseAdmin
      .from('vehicle_assignments')
      .select('id, booking_id, car_id, start_datetime, end_datetime, assigned_at, created_at'),
    supabaseAdmin
      .from('cars')
      .select('id, model_name, class, number_plate, capacity, driver_name, driver_phone, driver_email, is_active')
      .eq('is_active', true),
  ])

  if (bookingsResult.error) throw new Error('Failed to fetch active bookings')
  if (assignmentsResult.error) throw new Error('Failed to fetch vehicle assignments')
  if (carsResult.error) throw new Error('Failed to fetch active cars')

  // Filtering here rather than at each call site means every consumer of fleet
  // state — availability snapshots, the model quota check, and the conflict
  // scanner — agrees on which bookings currently hold a vehicle.
  //
  // A booking that already has a vehicle assigned always holds it, whatever its
  // expiry says. In practice an unpaid booking can never reach that state (it
  // cannot be assigned until payment is confirmed), so this is pure defence: it
  // guarantees a car with real work against it can never be handed to someone
  // else, even if a stale hold_expires_at survives some future status change.
  const now = Date.now()
  const assignedBookingIds = new Set(
    (assignmentsResult.data || [])
      .map(assignment => assignment.booking_id)
      .filter((id): id is string => Boolean(id))
  )
  const activeBookings = (bookingsResult.data || []).filter(booking => {
    if (isVehicleHoldActive(booking, now)) return true
    if (booking.booking_id && assignedBookingIds.has(booking.booking_id)) return true
    if (booking.id && assignedBookingIds.has(booking.id)) return true
    return false
  })

  return {
    activeBookings,
    assignments: assignmentsResult.data || [],
    activeCars: carsResult.data || [],
  }
}

export async function getModelAvailabilitySnapshot(
  window: ConflictWindow,
  options: { excludeBookingId?: string | null } = {}
): Promise<ModelAvailability[]> {
  const state = await loadFleetState()
  return buildModelAvailabilitySnapshot(state, window, options)
}

export async function getModelAvailability(
  modelName: string,
  window: ConflictWindow,
  options: { excludeBookingId?: string | null } = {}
): Promise<ModelAvailability | null> {
  const snapshot = await getModelAvailabilitySnapshot(window, options)
  return snapshot.find(model => model.model_name === modelName) || null
}

function buildModelAvailabilitySnapshot(
  state: FleetState,
  window: ConflictWindow,
  options: { excludeBookingId?: string | null } = {}
): ModelAvailability[] {
  const excluded = options.excludeBookingId
  const bookings = state.activeBookings.filter(booking => {
    if (!excluded) return true
    return !keyMatches(booking.booking_id, excluded) && !keyMatches(booking.id, excluded)
  })

  const bookingByKey = new Map<string, ConflictBooking>()
  bookings.forEach(booking => {
    if (booking.booking_id) bookingByKey.set(booking.booking_id, booking)
    if (booking.id) bookingByKey.set(booking.id, booking)
  })

  const carById = new Map(state.activeCars.map(car => [car.id, car]))
  const assignedBookingKeys = new Set<string>()
  const assignedCarIdsByModel = new Map<string, Set<string>>()

  state.assignments.forEach(assignment => {
    if (!assignment.car_id) return
    const booking = bookingByKey.get(assignment.booking_id)
    if (!booking) return
    if (!windowsOverlap(assignment.start_datetime, assignment.end_datetime, window.start, window.end)) return

    const car = carById.get(assignment.car_id)
    if (!car) return

    assignedBookingKeys.add(bookingKey(booking))

    if (!assignedCarIdsByModel.has(car.model_name)) {
      assignedCarIdsByModel.set(car.model_name, new Set())
    }
    assignedCarIdsByModel.get(car.model_name)!.add(car.id)
  })

  const unassignedByModel = new Map<string, number>()
  bookings.forEach(booking => {
    if (!booking.car_model) return
    if (!windowsOverlap(booking.start_datetime, booking.end_datetime, window.start, window.end)) return
    if (assignedBookingKeys.has(bookingKey(booking))) return

    unassignedByModel.set(booking.car_model, (unassignedByModel.get(booking.car_model) || 0) + 1)
  })

  const carsByModel = new Map<string, ConflictCar[]>()
  state.activeCars.forEach(car => {
    if (!carsByModel.has(car.model_name)) carsByModel.set(car.model_name, [])
    carsByModel.get(car.model_name)!.push(car)
  })

  return Array.from(carsByModel.entries())
    .map(([modelName, cars]) => {
      const rep = cars[0]
      const assignedCount = assignedCarIdsByModel.get(modelName)?.size || 0
      const unassignedCount = unassignedByModel.get(modelName) || 0
      const blockedCount = assignedCount + unassignedCount
      const rawAvailableCount = cars.length - blockedCount

      return {
        model_name: modelName,
        class: rep.class || '',
        capacity: Number(rep.capacity || 0),
        total_count: cars.length,
        assigned_count: assignedCount,
        unassigned_count: unassignedCount,
        blocked_count: blockedCount,
        raw_available_count: rawAvailableCount,
        available_count: Math.max(0, rawAvailableCount),
      }
    })
    .sort((a, b) => a.model_name.localeCompare(b.model_name))
}

export async function getSpecificCarAssignmentConflicts(input: {
  carId: string
  start: string
  end: string
  excludeBookingId?: string | null
}) {
  const state = await loadFleetState()
  const bookingByKey = new Map<string, ConflictBooking>()

  state.activeBookings.forEach(booking => {
    if (booking.booking_id) bookingByKey.set(booking.booking_id, booking)
    if (booking.id) bookingByKey.set(booking.id, booking)
  })

  const car = state.activeCars.find(c => c.id === input.carId) || null

  return state.assignments
    .filter(assignment => assignment.car_id === input.carId)
    .filter(assignment => {
      if (input.excludeBookingId && keyMatches(assignment.booking_id, input.excludeBookingId)) return false
      const booking = bookingByKey.get(assignment.booking_id)
      if (!booking) return false
      return windowsOverlap(assignment.start_datetime, assignment.end_datetime, input.start, input.end)
    })
    .map(assignment => {
      const booking = bookingByKey.get(assignment.booking_id) || null
      const overlap = overlapWindow(assignment.start_datetime, assignment.end_datetime, input.start, input.end)
      return {
        assignment,
        booking,
        car,
        overlap_start: overlap.start,
        overlap_end: overlap.end,
      }
    })
}

export async function isBookingWithinModelQuota(input: {
  bookingId: string
  modelName: string
  window: ConflictWindow
}): Promise<boolean> {
  const state = await loadFleetState()
  const carById = new Map(state.activeCars.map(car => [car.id, car]))
  const physicalCount = state.activeCars.filter(car => car.model_name === input.modelName).length

  if (physicalCount <= 0) return false

  const bookingByKey = new Map<string, ConflictBooking>()
  state.activeBookings.forEach(booking => {
    if (booking.booking_id) bookingByKey.set(booking.booking_id, booking)
    if (booking.id) bookingByKey.set(booking.id, booking)
  })

  const assignedBookingKeys = new Set<string>()
  const demandItems: { booking: ConflictBooking; source: 'assigned' | 'unassigned' }[] = []

  state.assignments.forEach(assignment => {
    if (!assignment.car_id) return
    const booking = bookingByKey.get(assignment.booking_id)
    const car = carById.get(assignment.car_id)
    if (!booking || !car) return
    if (car.model_name !== input.modelName) return
    if (!windowsOverlap(assignment.start_datetime, assignment.end_datetime, input.window.start, input.window.end)) return

    assignedBookingKeys.add(bookingKey(booking))
    demandItems.push({ booking, source: 'assigned' })
  })

  state.activeBookings.forEach(booking => {
    if (booking.car_model !== input.modelName) return
    if (assignedBookingKeys.has(bookingKey(booking))) return
    if (!windowsOverlap(booking.start_datetime, booking.end_datetime, input.window.start, input.window.end)) return
    demandItems.push({ booking, source: 'unassigned' })
  })

  demandItems.sort((a, b) => {
    const aCreated = toLocalTimeMs(a.booking.created_at || a.booking.start_datetime)
    const bCreated = toLocalTimeMs(b.booking.created_at || b.booking.start_datetime)
    return aCreated - bCreated || bookingKey(a.booking).localeCompare(bookingKey(b.booking))
  })

  const winners = demandItems.slice(0, physicalCount)
  return winners.some(item => keyMatches(item.booking.booking_id, input.bookingId) || keyMatches(item.booking.id, input.bookingId))
}

export async function scanSystemConflicts() {
  const state = await loadFleetState()

  const bookingByKey = new Map<string, ConflictBooking>()
  state.activeBookings.forEach(booking => {
    if (booking.booking_id) bookingByKey.set(booking.booking_id, booking)
    if (booking.id) bookingByKey.set(booking.id, booking)
  })

  const carById = new Map(state.activeCars.map(car => [car.id, car]))
  const activeAssignments = state.assignments.filter(
    assignment => Boolean(assignment.car_id) && bookingByKey.has(assignment.booking_id)
  )

  const assignmentConflicts: {
    issue_type?: 'same_car_overlap' | 'booking_double_assignment'
    car_id: string
    car_number_plate: string
    car_model: string
    assignment_a_car?: ConflictCar | null
    assignment_b_car?: ConflictCar | null
    booking_a: ConflictBooking | null
    booking_b: ConflictBooking | null
    overlap_start: string
    overlap_end: string
  }[] = []

  const assignmentsByCar = new Map<string, ConflictAssignment[]>()
  activeAssignments.forEach(assignment => {
    if (!assignmentsByCar.has(assignment.car_id)) assignmentsByCar.set(assignment.car_id, [])
    assignmentsByCar.get(assignment.car_id)!.push(assignment)
  })

  assignmentsByCar.forEach((assignments, carId) => {
    for (let i = 0; i < assignments.length; i++) {
      for (let j = i + 1; j < assignments.length; j++) {
        const a = assignments[i]
        const b = assignments[j]
        if (!windowsOverlap(a.start_datetime, a.end_datetime, b.start_datetime, b.end_datetime)) continue

        const car = carById.get(carId)
        const overlap = overlapWindow(a.start_datetime, a.end_datetime, b.start_datetime, b.end_datetime)
        assignmentConflicts.push({
          issue_type: 'same_car_overlap',
          car_id: carId,
          car_number_plate: car?.number_plate || 'Unknown',
          car_model: car?.model_name || 'Unknown',
          booking_a: bookingByKey.get(a.booking_id) || null,
          booking_b: bookingByKey.get(b.booking_id) || null,
          overlap_start: overlap.start,
          overlap_end: overlap.end,
        })
      }
    }
  })

  const assignmentsByBooking = new Map<string, ConflictAssignment[]>()
  activeAssignments.forEach(assignment => {
    if (!assignmentsByBooking.has(assignment.booking_id)) assignmentsByBooking.set(assignment.booking_id, [])
    assignmentsByBooking.get(assignment.booking_id)!.push(assignment)
  })

  assignmentsByBooking.forEach(assignments => {
    for (let i = 0; i < assignments.length; i++) {
      for (let j = i + 1; j < assignments.length; j++) {
        const a = assignments[i]
        const b = assignments[j]
        if (a.car_id === b.car_id) continue
        if (!windowsOverlap(a.start_datetime, a.end_datetime, b.start_datetime, b.end_datetime)) continue

        const carA = carById.get(a.car_id) || null
        const carB = carById.get(b.car_id) || null
        const overlap = overlapWindow(a.start_datetime, a.end_datetime, b.start_datetime, b.end_datetime)
        const booking = bookingByKey.get(a.booking_id) || null

        assignmentConflicts.push({
          issue_type: 'booking_double_assignment',
          car_id: a.car_id,
          car_number_plate: `${carA?.number_plate || 'Unknown'} + ${carB?.number_plate || 'Unknown'}`,
          car_model: 'Multiple vehicles',
          assignment_a_car: carA,
          assignment_b_car: carB,
          booking_a: booking,
          booking_b: booking,
          overlap_start: overlap.start,
          overlap_end: overlap.end,
        })
      }
    }
  })

  const carCountByModel = new Map<string, number>()
  state.activeCars.forEach(car => carCountByModel.set(car.model_name, (carCountByModel.get(car.model_name) || 0) + 1))

  const assignedBookingKeys = new Set(
    activeAssignments
      .filter(assignment => assignment.car_id && carById.has(assignment.car_id))
      .map(assignment => assignment.booking_id)
  )
  const demandByModel = new Map<string, {
    id: string
    model: string
    booking: ConflictBooking
    start: string
    end: string
  }[]>()

  activeAssignments.forEach(assignment => {
    const booking = bookingByKey.get(assignment.booking_id)
    const car = carById.get(assignment.car_id)
    if (!booking || !car) return

    const item = {
      id: `assignment:${assignment.id}`,
      model: car.model_name,
      booking,
      start: assignment.start_datetime,
      end: assignment.end_datetime,
    }
    if (!demandByModel.has(item.model)) demandByModel.set(item.model, [])
    demandByModel.get(item.model)!.push(item)
  })

  state.activeBookings.forEach(booking => {
    if (!booking.car_model) return
    if (assignedBookingKeys.has(bookingKey(booking))) return

    const item = {
      id: `booking:${bookingKey(booking)}`,
      model: booking.car_model,
      booking,
      start: booking.start_datetime,
      end: booking.end_datetime,
    }
    if (!demandByModel.has(item.model)) demandByModel.set(item.model, [])
    demandByModel.get(item.model)!.push(item)
  })

  const modelConflicts: {
    car_model: string
    physical_count: number
    demand_count: number
    conflicting_bookings: ConflictBooking[]
  }[] = []
  const seenModelClusters = new Set<string>()

  demandByModel.forEach((items, model) => {
    const physical = carCountByModel.get(model) || 0
    const events = items.flatMap(item => [
      { time: toLocalTimeMs(item.start), type: 'start' as const, item },
      { time: toLocalTimeMs(item.end), type: 'end' as const, item },
    ]).filter(event => !Number.isNaN(event.time))

    events.sort((a, b) => a.time - b.time || (a.type === 'end' ? -1 : 1))

    const active = new Map<string, (typeof items)[number]>()
    let idx = 0

    while (idx < events.length) {
      const time = events[idx].time
      const sameTime = []
      while (idx < events.length && events[idx].time === time) {
        sameTime.push(events[idx])
        idx++
      }

      sameTime.filter(event => event.type === 'end').forEach(event => active.delete(event.item.id))
      sameTime.filter(event => event.type === 'start').forEach(event => active.set(event.item.id, event.item))

      if (active.size <= physical) continue

      const activeItems = Array.from(active.values())
      const bookingMap = new Map<string, ConflictBooking>()
      activeItems.forEach(item => bookingMap.set(bookingKey(item.booking), item.booking))
      const clusterKey = `${model}:${Array.from(active.keys()).sort().join('|')}`
      if (seenModelClusters.has(clusterKey)) continue

      seenModelClusters.add(clusterKey)
      modelConflicts.push({
        car_model: model,
        physical_count: physical,
        demand_count: activeItems.length,
        conflicting_bookings: Array.from(bookingMap.values()),
      })
    }
  })

  return {
    assignment_conflicts: assignmentConflicts,
    model_conflicts: modelConflicts,
    total: assignmentConflicts.length + modelConflicts.length,
  }
}
