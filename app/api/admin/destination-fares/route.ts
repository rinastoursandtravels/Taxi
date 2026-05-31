import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminRequest } from '@/lib/admin-auth'

type FareInput = {
  model_name: string
  fixed_fare: number
}

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminRequest(request)
  if (unauthorized) return unauthorized

  try {
    const destinationId = request.nextUrl.searchParams.get('destination_id')
    if (!destinationId) {
      return NextResponse.json(
        { success: false, error: 'destination_id is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('destination_car_fares')
      .select('id, destination_id, model_name, fixed_fare, created_at, updated_at')
      .eq('destination_id', destinationId)
      .order('model_name', { ascending: true })

    if (error) {
      console.error('Error fetching destination fares:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, fares: data || [] })
  } catch (error) {
    console.error('Unexpected error fetching destination fares:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const unauthorized = requireAdminRequest(request)
  if (unauthorized) return unauthorized

  try {
    const body = await request.json()
    const destinationId: string = String(body.destination_id || '').trim()
    const faresRaw = Array.isArray(body.fares) ? body.fares : []

    if (!destinationId) {
      return NextResponse.json(
        { success: false, error: 'destination_id is required' },
        { status: 400 }
      )
    }

    const fareMap = new Map<string, number>()
    for (const item of faresRaw) {
      const modelName = String(item?.model_name || '').trim()
      const fixedFare = Number(item?.fixed_fare)
      if (!modelName) continue
      if (!Number.isFinite(fixedFare) || fixedFare <= 0) {
        return NextResponse.json(
          { success: false, error: `Invalid fixed_fare for model "${modelName}"` },
          { status: 400 }
        )
      }
      fareMap.set(modelName, fixedFare)
    }

    const fares: FareInput[] = Array.from(fareMap.entries()).map(([model_name, fixed_fare]) => ({
      model_name,
      fixed_fare,
    }))

    const { error: deleteError } = await supabaseAdmin
      .from('destination_car_fares')
      .delete()
      .eq('destination_id', destinationId)

    if (deleteError) {
      console.error('Error clearing destination fares:', deleteError)
      return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 })
    }

    if (fares.length > 0) {
      const payload = fares.map((fare) => ({
        destination_id: destinationId,
        model_name: fare.model_name,
        fixed_fare: fare.fixed_fare,
      }))

      const { error: insertError } = await supabaseAdmin
        .from('destination_car_fares')
        .insert(payload)

      if (insertError) {
        console.error('Error saving destination fares:', insertError)
        return NextResponse.json({ success: false, error: insertError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, saved_count: fares.length })
  } catch (error) {
    console.error('Unexpected error saving destination fares:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
