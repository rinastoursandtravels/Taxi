import { supabaseAdmin } from '@/lib/supabase-admin'
import { NextRequest } from 'next/server'
import {
  addMinutesToISTDateTime,
  createDateTimeIST,
  getConflictControlEnabled,
  getModelAvailability,
  isBookingWithinModelQuota,
} from '@/lib/conflicts'
import { logSystemEvent } from '@/lib/system-events'

export async function POST(request: NextRequest) {
  try {
    const bookingData = await request.json()

    console.log('Booking data received:', bookingData)

    // Validate required fields
    if (
      !bookingData.booking_id ||
      !bookingData.booking_type ||
      !bookingData.user_name ||
      !bookingData.phone ||
      bookingData.passenger_count === undefined ||
      bookingData.passenger_count === null ||
      !bookingData.booking_date ||
      !bookingData.start_time
    ) {
      const missingFields = []
      if (!bookingData.booking_id) missingFields.push('booking_id')
      if (!bookingData.booking_type) missingFields.push('booking_type')
      if (!bookingData.user_name) missingFields.push('user_name')
      if (!bookingData.phone) missingFields.push('phone')
      if (bookingData.passenger_count === undefined || bookingData.passenger_count === null) missingFields.push('passenger_count')
      if (!bookingData.booking_date) missingFields.push('booking_date')
      if (!bookingData.start_time) missingFields.push('start_time')

      return Response.json(
        { 
          error: `Missing required fields: ${missingFields.join(', ')}`,
          received: bookingData
        }, 
        { status: 400 }
      )
    }

    // Validate booking_type enum
    const validBookingTypes = ['taxi', 'tour']
    if (!validBookingTypes.includes(bookingData.booking_type)) {
      return Response.json(
        { error: `Invalid booking_type. Must be one of: ${validBookingTypes.join(', ')}` },
        { status: 400 }
      )
    }

    if (bookingData.booking_type === 'taxi' && !bookingData.destination_id) {
      return Response.json(
        { success: false, error: 'destination_id is required for taxi bookings' },
        { status: 400 }
      )
    }

    // Validate booking_status enum for legacy clients. New public bookings are
    // always stored as pending below, regardless of any client-supplied status.
    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled']
    if (bookingData.booking_status && !validStatuses.includes(bookingData.booking_status)) {
      return Response.json(
        { error: `Invalid booking_status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    // Ensure passenger_count is a positive integer
    const passengerCount = parseInt(String(bookingData.passenger_count))
    if (isNaN(passengerCount) || passengerCount <= 0) {
      return Response.json(
        { error: 'passenger_count must be a positive integer' },
        { status: 400 }
      )
    }

    let amountTotal = Number(bookingData.amount_total || 0)

    // Create start_datetime from booking_date and start_time (in IST)
    let startDateTimeStr: string
    try {
      startDateTimeStr = createDateTimeIST(bookingData.booking_date, bookingData.start_time)
    } catch (e) {
      return Response.json(
        { error: 'Invalid date or time format' },
        { status: 400 }
      )
    }

    // Calculate end_datetime based on booking type
    let endDateTimeStr: string = startDateTimeStr
    let durationMinutes = 0
    let tourPkg: { duration_hours: number | null; max_passengers: number | null; car_model: string | null } | null = null

    if (bookingData.booking_type === 'tour' && bookingData.tour_package_id) {
      // For tour bookings: fetch authoritative package data from the database.
      try {
        const { data: fetchedTourPkg, error: tourErr } = await supabaseAdmin
          .from('tour_packages')
          .select('duration_hours, max_passengers, car_model')
          .eq('id', bookingData.tour_package_id)
          .single()

        if (tourErr || !fetchedTourPkg) {
          return Response.json(
            { success: false, error: 'Tour package not found' },
            { status: 404 }
          )
        }

        tourPkg = fetchedTourPkg

        if (tourPkg.duration_hours) {
          durationMinutes = parseInt(String(tourPkg.duration_hours)) * 60
          console.log(`Tour booking: ${tourPkg.duration_hours} hrs (${durationMinutes} minutes)`)
        } else {
          console.warn('Could not fetch tour package duration, defaulting to 240 minutes')
          durationMinutes = 240
        }
      } catch (e) {
        console.error('Error fetching tour package:', e)
        return Response.json(
          { success: false, error: 'Failed to validate tour package' },
          { status: 500 }
        )
      }
    } else if (bookingData.booking_type === 'tour') {
      return Response.json(
        { success: false, error: 'tour_package_id is required for tour bookings' },
        { status: 400 }
      )
    } else if (bookingData.destination_id) {
      // For taxi bookings: use estimated_duration_minutes directly from the destination
      try {
        const { data: destination, error: destError } = await supabaseAdmin
          .from('destinations')
          .select('estimated_duration_minutes')
          .eq('id', bookingData.destination_id)
          .single()

        if (destError || !destination) {
          return Response.json(
            { success: false, error: 'Destination not found' },
            { status: 404 }
          )
        }

        if (destination.estimated_duration_minutes) {
          // Double the one-way duration: car is busy for trip + return to base
          durationMinutes = destination.estimated_duration_minutes * 2
          console.log(`Destination duration (x2 for return): ${durationMinutes} minutes`)
        } else {
          console.warn('Could not fetch destination duration, using default of 60 minutes')
          durationMinutes = 60
        }
      } catch (e) {
        console.error('Error fetching destination:', e)
        return Response.json(
          { success: false, error: 'Failed to validate destination' },
          { status: 500 }
        )
      }
    } else {
      durationMinutes = 60
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      return Response.json(
        { success: false, error: 'Booking duration must be greater than zero' },
        { status: 400 }
      )
    }

    endDateTimeStr = addMinutesToISTDateTime(startDateTimeStr, durationMinutes)
    console.log(`Start: ${startDateTimeStr}, End: ${endDateTimeStr}, Duration: ${durationMinutes} minutes (${(durationMinutes / 60).toFixed(2)} hours)`)

    const resolvedCarModel =
      bookingData.booking_type === 'tour'
        ? (tourPkg?.car_model || bookingData.car_model || null)
        : (bookingData.car_model || null)

    if (bookingData.booking_type !== 'tour' && !resolvedCarModel) {
      return Response.json(
        { success: false, error: 'car_model is required for taxi bookings' },
        { status: 400 }
      )
    }

    if (bookingData.booking_type === 'tour' && tourPkg?.max_passengers && passengerCount > Number(tourPkg.max_passengers)) {
      return Response.json(
        { success: false, error: `This tour allows a maximum of ${tourPkg.max_passengers} passenger(s)` },
        { status: 400 }
      )
    }

    if (bookingData.booking_type === 'tour') {
      if (!Number.isFinite(amountTotal) || amountTotal <= 0) {
        return Response.json(
          { error: 'amount_total must be a positive number' },
          { status: 400 }
        )
      }
    }

    if (bookingData.booking_type === 'taxi' && resolvedCarModel) {
      const { data: fareRow, error: fareError } = await supabaseAdmin
        .from('destination_car_fares')
        .select('fixed_fare')
        .eq('destination_id', bookingData.destination_id)
        .eq('model_name', resolvedCarModel)
        .maybeSingle()

      if (fareError) {
        console.error('Error validating destination fare:', fareError)
        return Response.json(
          { success: false, error: 'Failed to validate destination fare' },
          { status: 500 }
        )
      }

      const fixedFare = Number(fareRow?.fixed_fare || 0)
      if (!Number.isFinite(fixedFare) || fixedFare <= 0) {
        return Response.json(
          { success: false, error: `${resolvedCarModel} is not available for the selected destination` },
          { status: 409 }
        )
      }

      amountTotal = fixedFare
    }

    if (resolvedCarModel && bookingData.booking_type !== 'tour') {
      const { data: carsOfModel, error: carsError } = await supabaseAdmin
        .from('cars')
        .select('capacity')
        .eq('model_name', resolvedCarModel)
        .eq('is_active', true)

      if (carsError) {
        console.error('Error checking car model capacity:', carsError)
        return Response.json(
          { success: false, error: 'Failed to validate selected car model' },
          { status: 500 }
        )
      }

      if (!carsOfModel || carsOfModel.length === 0) {
        return Response.json(
          { success: false, error: `No active ${resolvedCarModel} vehicles are available` },
          { status: 409 }
        )
      }

      const maxCapacity = Math.max(...carsOfModel.map(car => Number(car.capacity || 0)))
      if (passengerCount > maxCapacity) {
        return Response.json(
          { success: false, error: `${resolvedCarModel} supports up to ${maxCapacity} passenger(s)` },
          { status: 400 }
        )
      }
    }

    const conflictControlEnabled = await getConflictControlEnabled()
    let conflictWarning: string | null = null

    if (conflictControlEnabled && resolvedCarModel) {
      const availability = await getModelAvailability(resolvedCarModel, {
        start: startDateTimeStr,
        end: endDateTimeStr,
      })

      const isAvailable = (availability?.available_count || 0) > 0

      if (!isAvailable && bookingData.booking_type !== 'tour') {
        return Response.json(
          {
            success: false,
            code: 'MODEL_UNAVAILABLE',
            error: `${resolvedCarModel} is no longer available for the selected timeslot. Please choose another vehicle or time.`,
          },
          { status: 409 }
        )
      }

      if (!isAvailable && bookingData.booking_type === 'tour') {
        conflictWarning = `The preferred ${resolvedCarModel} vehicle may not be available for this timeslot. The tour can still be booked, and another suitable vehicle may be assigned.`
      }
    }

    // Prepare booking data with new datetime schema
    const preparedBookingData = {
      booking_id: bookingData.booking_id,
      booking_type: bookingData.booking_type,
      user_name: bookingData.user_name,
      user_email: bookingData.user_email || null,
      phone: bookingData.phone,
      passenger_count: passengerCount,
      start_datetime: startDateTimeStr,
      end_datetime: endDateTimeStr,
      destination_id: bookingData.destination_id || null,
      tour_package_id: bookingData.tour_package_id || null,
      car_model: resolvedCarModel,
      amount_total: amountTotal,
      booking_status: 'pending',
    }

    console.log('Prepared booking data:', preparedBookingData)

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .insert([preparedBookingData])
      .select()
      .single()

    if (error) {
      console.error('Error creating booking:', error)
      if (error.code === '22P02' && String(error.message || '').includes('booking_type_enum')) {
        return Response.json(
          {
            success: false,
            error: 'Database schema is stale: booking_type_enum does not yet allow "taxi". Recreate or update the DB schema so booking_type_enum contains only taxi and tour.',
          },
          { status: 500 }
        )
      }
      return Response.json(
        { error: `Failed to create booking: ${error.message}`, details: error },
        { status: 500 }
      )
    }

    if (conflictControlEnabled && bookingData.booking_type !== 'tour' && resolvedCarModel) {
      const quotaWinner = await isBookingWithinModelQuota({
        bookingId: data.booking_id,
        modelName: resolvedCarModel,
        window: { start: startDateTimeStr, end: endDateTimeStr },
      })

      if (!quotaWinner) {
        await supabaseAdmin
          .from('bookings')
          .delete()
          .eq('id', data.id)

        return Response.json(
          {
            success: false,
            code: 'MODEL_UNAVAILABLE',
            error: `${resolvedCarModel} was just booked for this timeslot. Please choose another vehicle or time.`,
          },
          { status: 409 }
        )
      }
    }

    console.log('Booking created successfully:', data)
    await logSystemEvent({
      severity: 'info',
      event_type: 'booking_created',
      actor_type: 'user',
      actor_label: bookingData.user_email || bookingData.user_name || null,
      entity_type: 'booking',
      entity_id: data.booking_id || data.id,
      message: `Booking created (${bookingData.booking_type})`,
      metadata: {
        booking_type: bookingData.booking_type,
        amount_total: amountTotal,
        passenger_count: passengerCount,
        conflict_warning: Boolean(conflictWarning),
      },
    })
    return Response.json({ success: true, booking: data, conflict_warning: conflictWarning })
  } catch (error) {
    console.error('Booking creation error:', error)
    await logSystemEvent({
      severity: 'error',
      event_type: 'booking_create_failed',
      actor_type: 'system',
      message: 'Booking creation failed',
      metadata: { error: error instanceof Error ? error.message : String(error) },
    })
    return Response.json(
      { error: 'Failed to create booking', details: String(error) },
      { status: 500 }
    )
  }
}
