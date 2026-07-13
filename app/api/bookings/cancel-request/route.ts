import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isUuid } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { booking_id, user_email, reason } = await request.json()

    if (!booking_id || !user_email) {
      return NextResponse.json(
        { success: false, error: 'booking_id and user_email are required' },
        { status: 400 }
      )
    }

    // booking_id maps to a UUID column (id or booking_id). Reject anything that
    // isn't a UUID so it can never inject extra PostgREST filter syntax below.
    if (!isUuid(booking_id)) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 })
    }

    // Only select columns that always exist — do NOT include new migration columns here
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, booking_id, booking_status, user_email')
      .or(`id.eq.${booking_id},booking_id.eq.${booking_id}`)
      .limit(1)
      .maybeSingle()

    if (bookingError) {
      console.error('[CANCEL-REQUEST] DB lookup error:', bookingError)
      return NextResponse.json({ success: false, error: 'Failed to look up booking' }, { status: 500 })
    }

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 })
    }

    if (booking.user_email?.toLowerCase() !== user_email.toLowerCase()) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
    }

    if (booking.booking_status !== 'confirmed') {
      return NextResponse.json(
        { success: false, error: 'Only confirmed bookings can be cancelled' },
        { status: 400 }
      )
    }

    // Check for an existing pending request (separate query so schema errors are isolated)
    const { data: existingCheck } = await supabaseAdmin
      .from('bookings')
      .select('cancellation_requested_at')
      .eq('id', booking.id)
      .maybeSingle()

    if (existingCheck?.cancellation_requested_at) {
      return NextResponse.json(
        { success: false, error: 'A cancellation request is already pending for this booking' },
        { status: 400 }
      )
    }

    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        cancellation_requested_at: new Date().toISOString(),
        cancellation_reason: reason?.trim() || null,
      })
      .eq('id', booking.id)

    if (updateError) {
      console.error('[CANCEL-REQUEST] Update error:', updateError)
      if (updateError.message?.includes('column') || updateError.code === '42703') {
        return NextResponse.json(
          { success: false, error: 'Database migration not applied. Please run the required SQL migration.' },
          { status: 500 }
        )
      }
      throw updateError
    }

    return NextResponse.json({ success: true, message: 'Cancellation request submitted successfully' })
  } catch (error) {
    console.error('[CANCEL-REQUEST] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to submit cancellation request' },
      { status: 500 }
    )
  }
}
