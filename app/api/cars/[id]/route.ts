import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminRequest } from '@/lib/admin-auth'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = requireAdminRequest(request)
  if (unauthorized) return unauthorized

  try {
    const { id } = params
    const body = await request.json()
    const { is_active } = body

    if (is_active === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing is_active field' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('cars')
      .update({ is_active })
      .eq('id', id)
      .select()

    if (error) {
      console.error('Error updating car status:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, car: data[0] })
  } catch (error) {
    console.error('Unexpected error updating car status:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = requireAdminRequest(request)
  if (unauthorized) return unauthorized

  try {
    const { id } = params
    const { error } = await supabaseAdmin.from('cars').delete().eq('id', id)

    if (error) {
      console.error('Error deleting car:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Car permanently deleted successfully' })
  } catch (error) {
    console.error('Unexpected error deleting car:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = requireAdminRequest(request)
  if (unauthorized) return unauthorized

  try {
    const { id } = params
    const body = await request.json()
    const {
      model_name,
      class: carClass,
      number_plate,
      capacity,
      driver_name,
      driver_phone,
      driver_email,
      driver_verified,
    } = body

    const { data, error } = await supabaseAdmin
      .from('cars')
      .update({
        model_name,
        class: carClass,
        number_plate,
        capacity: parseInt(capacity),
        driver_name,
        driver_phone,
        driver_email: driver_email || null,
        driver_verified: driver_verified || false,
      })
      .eq('id', id)
      .select()

    if (error) {
      console.error('Error updating car:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, car: data[0] })
  } catch (error) {
    console.error('Unexpected error updating car:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
