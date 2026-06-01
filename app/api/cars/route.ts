import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminRequest } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const includeInactive = searchParams.get('include_inactive') === 'true'
    if (includeInactive) {
      const unauthorized = requireAdminRequest(request)
      if (unauthorized) return unauthorized
    }

    let query = supabaseAdmin
      .from('cars')
      .select(`
        id,
        model_name,
        class,
        number_plate,
        capacity,
        driver_name,
        driver_phone,
        driver_email,
        driver_verified,
        is_active,
        created_at
      `)

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching cars:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, cars: data })
  } catch (error) {
    console.error('Unexpected error fetching cars:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminRequest(request)
  if (unauthorized) return unauthorized

  try {
    const body = await request.json()
    const { 
      model_name, 
      class: carClass, 
      number_plate,
      capacity,
      driver_name,
      driver_phone,
      driver_email,
      driver_verified
    } = body

    // Validation
    if (!model_name || !carClass || !number_plate || !capacity || !driver_name || !driver_phone) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin.from('cars').insert([
      {
        model_name,
        class: carClass,
        number_plate,
        capacity: parseInt(capacity),
        driver_name,
        driver_phone,
        driver_email: driver_email || null,
        driver_verified: driver_verified || false,
        is_active: true,
      },
    ]).select()

    if (error) {
      console.error('Error creating car:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, car: data[0] }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error creating car:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
