import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminRequest } from '@/lib/admin-auth'

function normalizeArrivalTime(value: unknown): string | null {
  if (!value) return null
  const raw = String(value).trim()
  if (!raw) return null
  const match = raw.match(/[T\s]?(\d{2}):(\d{2})/)
  if (!match) return null
  return `${match[1]}:${match[2]}`
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = requireAdminRequest(request)
  if (unauthorized) return unauthorized

  try {
    const { id } = params

    const { error } = await supabaseAdmin.from('tour_packages').update({ is_active: false }).eq('id', id)

    if (error) {
      console.error('Error deleting tour:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Tour deleted successfully' })
  } catch (error) {
    console.error('Unexpected error deleting tour:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = requireAdminRequest(request)
  if (unauthorized) return unauthorized

  try {
    const { id } = params
    const body = await request.json()
    const { name, description, arrival_time, duration_hours, price, max_passengers, car_model, itinerary, highlights, image_url, image_urls } = body

    // Validation
    if (!name || !price) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name and price' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('tour_packages')
      .update({
        name,
        description: description || null,
        arrival_time: normalizeArrivalTime(arrival_time),
        duration_hours: duration_hours ? parseInt(duration_hours) : null,
        price: parseFloat(price),
        max_passengers: max_passengers ? parseInt(max_passengers) : null,
        car_model: car_model || null,
        itinerary: itinerary || null,
        highlights: highlights && Array.isArray(highlights) ? highlights : [],
        image_url: image_url || null,
        image_urls: Array.isArray(image_urls) ? image_urls : [],
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()

    if (error) {
      console.error('Error updating tour:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, tour: data[0] })
  } catch (error) {
    console.error('Unexpected error updating tour:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
