import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminRequest } from '@/lib/admin-auth'
import { isUuid } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const unauthorized = requireAdminRequest(request)
  if (unauthorized) return unauthorized

  try {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false, nullsFirst: false })

    if (error) {
      console.error('Error fetching admin bookings:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, bookings: data || [] })
  } catch (error) {
    console.error('Admin bookings fetch error:', error)
    return Response.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const unauthorized = requireAdminRequest(request)
  if (unauthorized) return unauthorized

  try {
    const { booking_id } = await request.json()

    if (!booking_id || typeof booking_id !== 'string') {
      return Response.json(
        { success: false, error: 'booking_id is required' },
        { status: 400 }
      )
    }

    // Guard the interpolated PostgREST filter below: only a UUID is ever a valid
    // booking identifier, and a UUID cannot carry filter-injection characters.
    if (!isUuid(booking_id)) {
      return Response.json({ success: false, error: 'Booking not found' }, { status: 404 })
    }

    const { data: booking, error: bookingLookupError } = await supabaseAdmin
      .from('bookings')
      .select('id, booking_id')
      .or(`id.eq.${booking_id},booking_id.eq.${booking_id}`)
      .limit(1)
      .maybeSingle()

    if (bookingLookupError) {
      console.error('Error looking up booking to delete:', bookingLookupError)
      return Response.json(
        { success: false, error: 'Failed to locate booking before delete' },
        { status: 500 }
      )
    }

    if (!booking) {
      return Response.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      )
    }

    const identifiers = Array.from(new Set([booking.id, booking.booking_id].filter(Boolean)))
    const cleanupResults: Record<string, number> = {}

    for (const tableName of ['vehicle_assignments', 'payments', 'assignments']) {
      const { data: deletedRows, error } = await supabaseAdmin
        .from(tableName)
        .delete()
        .in('booking_id', identifiers)
        .select('id')

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205') {
          // Optional/legacy table not present in this deployment, skip it.
          cleanupResults[tableName] = 0
          continue
        }
        console.error(`Error deleting related rows from ${tableName}:`, error)
        return Response.json(
          { success: false, error: `Failed to delete associated ${tableName} records` },
          { status: 500 }
        )
      }

      cleanupResults[tableName] = deletedRows?.length || 0
    }

    const { error: bookingDeleteError } = await supabaseAdmin
      .from('bookings')
      .delete()
      .eq('id', booking.id)

    if (bookingDeleteError) {
      console.error('Error deleting booking:', bookingDeleteError)
      return Response.json(
        { success: false, error: 'Failed to delete booking' },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      deleted_booking_id: booking.booking_id,
      cleanup: cleanupResults,
    })
  } catch (error) {
    console.error('Admin booking delete error:', error)
    return Response.json(
      { success: false, error: 'Failed to delete booking' },
      { status: 500 }
    )
  }
}
