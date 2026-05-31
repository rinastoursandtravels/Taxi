import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  createDateTimeIST,
  getConflictControlEnabled,
  getModelAvailabilitySnapshot,
  toLocalTimeMs,
} from '@/lib/conflicts'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cars/available-models
 *
 * Customer taxi availability is destination-scoped and strict when conflict control is ON:
 * pending and confirmed bookings both hold capacity, assigned bookings consume
 * the assigned car's actual model, and unassigned bookings consume the requested
 * model. Tours use the same holds, but tour creation itself remains advisory.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const destinationId = sp.get('destination_id')
    const bookingDate = sp.get('booking_date')
    const startTime = sp.get('start_time')
    const endTime = sp.get('end_time')
    const endDate = sp.get('end_date') || bookingDate

    if (!destinationId || !bookingDate || !startTime || !endTime || !endDate) {
      return NextResponse.json(
        { success: false, error: 'Missing required query parameters: destination_id, booking_date, start_time, end_time' },
        { status: 400 }
      )
    }

    const { data: fareRows, error: faresError } = await supabaseAdmin
      .from('destination_car_fares')
      .select('model_name, fixed_fare')
      .eq('destination_id', destinationId)

    if (faresError) throw new Error('Failed to fetch destination fares')

    const fareMap = new Map<string, number>()
    ;(fareRows || []).forEach((row) => {
      const model = String(row.model_name || '').trim()
      const fare = Number(row.fixed_fare)
      if (!model || !Number.isFinite(fare) || fare <= 0) return
      fareMap.set(model, fare)
    })

    const conflictControlEnabled = await getConflictControlEnabled()

    if (fareMap.size === 0) {
      return NextResponse.json({ success: true, models: [], conflict_control_enabled: conflictControlEnabled })
    }

    if (!conflictControlEnabled) {
      const { data: allCars, error: allCarsError } = await supabaseAdmin
        .from('cars')
        .select('id, model_name, class, capacity')
        .eq('is_active', true)
        .order('model_name', { ascending: true })

      if (allCarsError) throw new Error('Failed to fetch cars')

      const modelMap = new Map<string, { model_name: string; class: string; capacity: number }>()
      const counts = new Map<string, number>()

      ;(allCars || []).forEach(car => {
        if (!fareMap.has(car.model_name)) return
        if (!modelMap.has(car.model_name)) modelMap.set(car.model_name, car)
        else {
          const current = modelMap.get(car.model_name)!
          if (Number(car.capacity || 0) > Number(current.capacity || 0)) {
            modelMap.set(car.model_name, { ...current, capacity: Number(car.capacity || 0) })
          }
        }
        counts.set(car.model_name, (counts.get(car.model_name) || 0) + 1)
      })

      const models = Array.from(modelMap.values()).map(rep => ({
        model_name: rep.model_name,
        class: rep.class,
        capacity: rep.capacity,
        fixed_fare: fareMap.get(rep.model_name) || 0,
        available_count: counts.get(rep.model_name) || 1,
      }))

      return NextResponse.json({ success: true, models, conflict_control_enabled: false })
    }

    const requestStart = createDateTimeIST(bookingDate, startTime)
    const requestEnd = createDateTimeIST(endDate, endTime)

    if (toLocalTimeMs(requestEnd) <= toLocalTimeMs(requestStart)) {
      return NextResponse.json(
        { success: false, error: 'Invalid date/time: end must be after start' },
        { status: 400 }
      )
    }

    const snapshot = await getModelAvailabilitySnapshot({ start: requestStart, end: requestEnd })
    const models = snapshot
      .filter(model => model.available_count > 0 && fareMap.has(model.model_name))
      .map(model => ({
        model_name: model.model_name,
        class: model.class,
        capacity: model.capacity,
        fixed_fare: fareMap.get(model.model_name) || 0,
        available_count: model.available_count,
      }))

    return NextResponse.json({ success: true, models, conflict_control_enabled: true })
  } catch (error) {
    console.error('Error in available-models:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
