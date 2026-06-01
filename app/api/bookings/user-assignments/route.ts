import { supabaseAdmin } from '@/lib/supabase-admin'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

// POST body: { bookingIds: string[] }
// Returns all vehicle_assignments (with car details) for the given booking_ids.
export async function POST(request: NextRequest) {
  try {
    const { bookingIds } = await request.json()

    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      return Response.json({ success: true, assignments: [] })
    }

    const { data: assignments, error } = await supabaseAdmin
      .from('vehicle_assignments')
      .select(`
        id,
        booking_id,
        car_id,
        start_datetime,
        end_datetime,
        assigned_at,
        car_model_snapshot,
        car_number_plate_snapshot,
        car_class_snapshot,
        driver_name_snapshot,
        driver_phone_snapshot,
        driver_email_snapshot
      `)
      .in('booking_id', bookingIds)

    if (error) {
      console.error('Error fetching user assignments:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    const rows = assignments || []
    const carIds = Array.from(
      new Set(
        rows
          .map((row) => row.car_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    )

    let carById: Record<string, {
      id: string
      model_name: string
      class: string
      number_plate: string
      capacity: number
      driver_name: string
      driver_phone: string
      driver_email: string | null
    }> = {}

    if (carIds.length > 0) {
      const { data: cars, error: carsError } = await supabaseAdmin
        .from('cars')
        .select('id, model_name, class, number_plate, capacity, driver_name, driver_phone, driver_email')
        .in('id', carIds)

      if (carsError) {
        console.error('Error fetching cars for assignments:', carsError)
      } else {
        carById = Object.fromEntries((cars || []).map((car) => [car.id, car]))
      }
    }

    const merged = rows.map((assignment) => ({
      ...assignment,
      cars: assignment.car_id ? (carById[assignment.car_id] || null) : null,
    }))

    return Response.json({ success: true, assignments: merged })
  } catch (err) {
    console.error('user-assignments route error:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
