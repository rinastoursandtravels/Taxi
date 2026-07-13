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

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('tour_packages')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching tours:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, tours: data })
  } catch (error) {
    console.error('Unexpected error fetching tours:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminRequest(request)
  if (unauthorized) return unauthorized

  try {
    const body = await request.json()
    const { name, description, arrival_time, duration_hours, price, max_passengers, car_model, itinerary, highlights, image_url, image_urls } = body

    // Validation
    if (!name || !price) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name and price' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin.from('tour_packages').insert([
      {
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
        is_active: true,
      },
    ]).select()

    if (error) {
      console.error('Error creating tour:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, tour: data[0] }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error creating tour:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
