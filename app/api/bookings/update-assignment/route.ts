import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminRequest } from '@/lib/admin-auth'
import { getSpecificCarAssignmentConflicts } from '@/lib/conflicts'
import { isValidEmail, sendAdminDriverEmailAlert, sendDriverAssignment, sendVehicleAssignment } from '@/lib/resend-notifications'

function isAssignmentOverlapError(error: unknown): boolean {
  const err = error as { code?: unknown; message?: unknown; details?: unknown }
  const text = `${String(err?.message || '')} ${String(err?.details || '')}`.toLowerCase()
  return err?.code === '23P01' || text.includes('overlapping active vehicle assignment')
}

const BOOKING_ASSIGNMENT_SELECT = 'id, booking_id, passenger_count, start_datetime, end_datetime, user_name, phone, booking_type, destination_id, tour_package_id'

function normalizeIdentifier(value?: unknown): string {
  return String(value || '').trim().replace(/[\u200B-\u200D\uFEFF]/g, '')
}

function getPickupDateFromStart(startDateTime?: string | null): string | undefined {
  const raw = String(startDateTime || '').trim()
  if (!raw) return undefined
  return raw.includes('T') ? raw.split('T')[0] : raw.split(' ')[0]
}

function getPickupTimeFromStart(startDateTime?: string | null): string | undefined {
  const raw = String(startDateTime || '').trim()
  if (!raw) return undefined

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  const timePart = raw.includes('T') ? raw.split('T')[1] : raw.split(' ')[1]
  return timePart ? timePart.slice(0, 5) : undefined
}

async function fetchBookingByAnyId(...identifiers: Array<unknown>) {
  const candidates = Array.from(new Set(identifiers.map(normalizeIdentifier).filter(Boolean)))

  for (const candidate of candidates) {
    const byBookingId = await supabaseAdmin
      .from('bookings')
      .select(BOOKING_ASSIGNMENT_SELECT)
      .eq('booking_id', candidate)
      .maybeSingle()

    if (!byBookingId.error && byBookingId.data) {
      return { booking: byBookingId.data, resolverPath: 'booking_id', usedIdentifier: candidate }
    }

    const byId = await supabaseAdmin
      .from('bookings')
      .select(BOOKING_ASSIGNMENT_SELECT)
      .eq('id', candidate)
      .maybeSingle()

    if (!byId.error && byId.data) {
      return { booking: byId.data, resolverPath: 'id_fallback', usedIdentifier: candidate }
    }
  }

  return { booking: null, resolverPath: null, usedIdentifier: candidates[0] || '' }
}

function maskIdentifier(value?: string | null): string {
  const raw = String(value || '').trim()
  if (!raw) return '(empty)'
  if (raw.length <= 10) return `${raw.slice(0, 3)}...${raw.slice(-2)}`
  return `${raw.slice(0, 6)}...${raw.slice(-4)}`
}

export async function POST(request: Request) {
  const unauthorized = requireAdminRequest(request)
  if (unauthorized) return unauthorized

  try {
    const body = await request.json()
    const { assignment_id, booking_id, booking_row_id, car_id, start_datetime, end_datetime, user_email, user_name } = body

    console.log('[UPDATE_ASSIGNMENT] Incoming payload', {
      assignment_id: maskIdentifier(assignment_id),
      booking_id: maskIdentifier(booking_id),
      booking_row_id: maskIdentifier(booking_row_id),
      car_id: maskIdentifier(car_id),
      has_start_datetime: Boolean(start_datetime),
      has_end_datetime: Boolean(end_datetime),
    })

    // Validate required fields
    if (!assignment_id || !car_id) {
      return Response.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify assignment exists
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from('vehicle_assignments')
      .select('*')
      .eq('id', assignment_id)
      .single()

    if (assignmentError || !assignment) {
      console.error('Assignment not found:', assignmentError)
      return Response.json(
        { success: false, error: 'Vehicle assignment not found' },
        { status: 404 }
      )
    }

    console.log('✅ Assignment verified:', assignment)

    // Verify new car exists
    const { data: car, error: carError } = await supabaseAdmin
      .from('cars')
      .select('id, model_name, class, number_plate, driver_name, driver_phone, driver_email, capacity')
      .eq('id', car_id)
      .single()

    if (carError || !car) {
      console.error('Car not found:', carError)
      return Response.json(
        { success: false, error: 'Vehicle not found' },
        { status: 404 }
      )
    }

    console.log('✅ New car verified:', car)

    // Get old car details for comparison
    const { data: oldCar } = await supabaseAdmin
      .from('cars')
      .select('id, model_name, number_plate, driver_name, driver_phone')
      .eq('id', assignment.car_id)
      .single()

    const actualStartDateTime = start_datetime || assignment.start_datetime
    const actualEndDateTime = end_datetime || assignment.end_datetime
    const resolvedBookingIdentifier = normalizeIdentifier(booking_id)
      || normalizeIdentifier(booking_row_id)
      || assignment.booking_id
    const resolvedBooking = await fetchBookingByAnyId(booking_id, booking_row_id, assignment.booking_id)
    const bookingDetails = resolvedBooking.booking
    const canonicalBookingId = bookingDetails?.booking_id || assignment.booking_id
    if (!bookingDetails) {
      console.error('[UPDATE_ASSIGNMENT] Booking not found', {
        assignment_id: maskIdentifier(assignment_id),
        booking_id: maskIdentifier(booking_id),
        booking_row_id: maskIdentifier(booking_row_id),
        used_identifier: maskIdentifier(resolvedBookingIdentifier),
      })
      return Response.json(
        {
          success: false,
          error: 'Booking not found',
          diagnostic: {
            assignment_id: maskIdentifier(assignment_id),
            booking_id: maskIdentifier(booking_id),
            booking_row_id: maskIdentifier(booking_row_id),
            used_identifier: maskIdentifier(resolvedBookingIdentifier),
          },
        },
        { status: 404 }
      )
    }
    console.log('[UPDATE_ASSIGNMENT] Booking resolved', {
      resolver_path: resolvedBooking.resolverPath || (resolvedBookingIdentifier === bookingDetails.booking_id ? 'booking_id' : 'id_fallback'),
      resolved_booking_id: maskIdentifier(bookingDetails.booking_id),
      resolved_row_id: maskIdentifier(bookingDetails.id),
    })

    let conflictChecks = await getSpecificCarAssignmentConflicts({
      carId: car_id,
      start: actualStartDateTime,
      end: actualEndDateTime,
      excludeBookingId: canonicalBookingId,
    })
    const hasCapacityWarning = Number(bookingDetails?.passenger_count || 0) > Number(car.capacity || 0)
    let warnings = [
      ...(conflictChecks.length > 0
        ? [{
            type: 'assignment_conflict',
            message: 'This vehicle is already assigned to another active booking in the selected time window. Admin override was allowed and recorded; resolve it later from the conflict scanner.',
            conflicts: conflictChecks,
          }]
        : []),
      ...(hasCapacityWarning
        ? [{
            type: 'capacity_warning',
            message: `This vehicle has ${car.capacity} seats but the booking has ${bookingDetails?.passenger_count} passenger(s).`,
        }]
        : []),
    ]
    let shouldRecordOverride = conflictChecks.length > 0

    let updatePayload: Record<string, unknown> = {
      car_id: car_id,
      start_datetime: actualStartDateTime,
      end_datetime: actualEndDateTime,
      car_model_snapshot: car.model_name,
      car_number_plate_snapshot: car.number_plate,
      car_class_snapshot: car.class || null,
      driver_name_snapshot: car.driver_name || null,
      driver_phone_snapshot: car.driver_phone || null,
      driver_email_snapshot: car.driver_email || null,
      conflict_override: shouldRecordOverride,
      conflict_override_reason: shouldRecordOverride ? 'Admin reassigned this vehicle despite an overlapping active assignment.' : null,
      conflict_override_at: shouldRecordOverride ? new Date().toISOString() : null,
    }

    // Update vehicle assignment record
    let updateResult = await supabaseAdmin
      .from('vehicle_assignments')
      .update(updatePayload)
      .eq('id', assignment_id)
      .select()
      .single()

    if (updateResult.error && isAssignmentOverlapError(updateResult.error) && !shouldRecordOverride) {
      conflictChecks = await getSpecificCarAssignmentConflicts({
        carId: car_id,
        start: actualStartDateTime,
        end: actualEndDateTime,
        excludeBookingId: canonicalBookingId,
      })
      shouldRecordOverride = true
      warnings = [
        {
          type: 'assignment_conflict',
          message: 'This vehicle became assigned to another active booking while you were saving. Admin override was allowed and recorded; resolve it later from the conflict scanner.',
          conflicts: conflictChecks,
        },
        ...(hasCapacityWarning
          ? [{
              type: 'capacity_warning',
              message: `This vehicle has ${car.capacity} seats but the booking has ${bookingDetails?.passenger_count} passenger(s).`,
            }]
          : []),
      ]
      updatePayload = {
        ...updatePayload,
        conflict_override: true,
        conflict_override_reason: 'Admin reassigned this vehicle despite a concurrent overlapping active assignment.',
        conflict_override_at: new Date().toISOString(),
      }

      updateResult = await supabaseAdmin
        .from('vehicle_assignments')
        .update(updatePayload)
        .eq('id', assignment_id)
        .select()
        .single()
    }

    if (updateResult.error && String(updateResult.error.message || '').includes('conflict_override')) {
      const legacyPayload = { ...updatePayload }
      delete legacyPayload.conflict_override
      delete legacyPayload.conflict_override_reason
      delete legacyPayload.conflict_override_at

      updateResult = await supabaseAdmin
        .from('vehicle_assignments')
        .update(legacyPayload)
        .eq('id', assignment_id)
        .select()
        .single()
    }

    if (updateResult.error) {
      console.error('Error updating assignment:', updateResult.error)
      return Response.json(
        { success: false, error: 'Failed to update vehicle assignment' },
        { status: 500 }
      )
    }

    const updatedAssignment = updateResult.data
    console.log('✅ Assignment updated successfully:', updatedAssignment)

    const pickupDate = getPickupDateFromStart(bookingDetails?.start_datetime || actualStartDateTime)
    const pickupTime = getPickupTimeFromStart(bookingDetails?.start_datetime || actualStartDateTime)
    const bookingType = bookingDetails?.booking_type === 'tour' ? 'tour' : 'taxi'
    let destination: string | undefined
    let tourPackageName: string | undefined

    if (bookingType === 'tour' && bookingDetails?.tour_package_id) {
      const { data: tour } = await supabaseAdmin
        .from('tour_packages')
        .select('name')
        .eq('id', bookingDetails.tour_package_id)
        .single()
      tourPackageName = tour?.name || undefined
    }

    if (bookingType !== 'tour' && bookingDetails?.destination_id) {
      const { data: destinationRow } = await supabaseAdmin
        .from('destinations')
        .select('name')
        .eq('id', bookingDetails.destination_id)
        .single()
      destination = destinationRow?.name || undefined
    }

    // Send reassignment email to customer
    if (user_email) {
      await sendVehicleAssignment({
        to: user_email,
        userName: user_name || 'Customer',
        bookingId: canonicalBookingId,
        bookingType,
        destination,
        tourPackageName,
        pickupDate,
        pickupTime,
        vehicleModel: car.model_name,
        numberPlate: car.number_plate,
        driverName: car.driver_name,
        driverPhone: car.driver_phone,
        isReassignment: true,
      }).catch((err) => console.error('[EMAIL] Reassignment email error:', err))
    }

    // Send reassignment notification to driver — gracefully handle bad email
    ;(async () => {
      const driverEmail = car.driver_email?.trim() || ''
      if (!driverEmail) return

      if (!isValidEmail(driverEmail)) {
        console.warn(`[EMAIL] Driver email invalid format: "${driverEmail}" — notifying admin`)
        await sendAdminDriverEmailAlert({
          bookingId: canonicalBookingId,
          driverName: car.driver_name,
          driverEmail,
          carModel: car.model_name,
          numberPlate: car.number_plate,
          reason: 'invalid_format',
        }).catch((err) => console.error('[EMAIL] Admin driver alert error:', err))
        return
      }

      const result = await sendDriverAssignment({
        to: driverEmail,
        driverName: car.driver_name,
        bookingId: canonicalBookingId,
        bookingType,
        destination,
        tourPackageName,
        customerName: bookingDetails?.user_name || user_name || 'Customer',
        customerPhone: bookingDetails?.phone || '',
        pickupDate,
        pickupTime,
        vehicleModel: car.model_name,
        numberPlate: car.number_plate,
        isReassignment: true,
      }).catch((err) => {
        console.error('[EMAIL] Driver reassignment email error:', err)
        return { success: false, error: err }
      })

      if (!result.success) {
        console.warn(`[EMAIL] Driver email delivery failed for "${driverEmail}" — notifying admin`)
        await sendAdminDriverEmailAlert({
          bookingId: canonicalBookingId,
          driverName: car.driver_name,
          driverEmail,
          carModel: car.model_name,
          numberPlate: car.number_plate,
          reason: 'send_failed',
        }).catch((err) => console.error('[EMAIL] Admin driver alert error:', err))
      }
    })().catch((err) => console.error('[EMAIL] Driver email flow error:', err))

    return Response.json(
      {
        success: true,
        message: 'Vehicle assignment updated successfully',
        assignment: updatedAssignment,
        warnings,
        conflict_override: shouldRecordOverride,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error in update-assignment route:', error)
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
