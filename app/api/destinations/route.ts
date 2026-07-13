import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminRequest } from '@/lib/admin-auth'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('destinations')
      .select(`
        id,
        name,
        estimated_duration_minutes,
        description,
        is_active,
        created_at
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching destinations:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, destinations: data })
  } catch (error) {
    console.error('Unexpected error fetching destinations:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminRequest(request)
  if (unauthorized) return unauthorized

  try {
    const body = await request.json()
    const { name, estimated_duration_minutes, description } = body

    if (!name || estimated_duration_minutes == null) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const minutes = parseInt(String(estimated_duration_minutes))
    if (isNaN(minutes) || minutes <= 0) {
      return NextResponse.json(
        { success: false, error: 'estimated_duration_minutes must be a positive integer' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin.from('destinations').insert([
      {
        name,
        estimated_duration_minutes: minutes,
        description: description || null,
        is_active: true,
      },
    ]).select()

    if (error) {
      console.error('Error creating destination:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, destination: data[0] }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error creating destination:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
