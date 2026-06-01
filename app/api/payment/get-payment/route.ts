import { supabaseAdmin } from '@/lib/supabase-admin'
import { getPaymentRecordsByPaymentId } from '@/lib/payment-db'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const bookingId = searchParams.get('bookingId')

    if (!bookingId) {
      return Response.json(
        {
          success: false,
          error: 'Missing bookingId parameter',
        },
        { status: 400 }
      )
    }

    const enrichPaymentResponse = async (paymentRow: any, canonicalBookingId: string | null) => {
      const { data: records } = await getPaymentRecordsByPaymentId(paymentRow.id)

      const resolvedBookingId = canonicalBookingId || paymentRow.booking_id || null
      let bookingDetails: any = null
      let destinationName: string | null = null
      let tourName: string | null = null

      if (resolvedBookingId) {
        const { data: booking } = await supabaseAdmin
          .from('bookings')
          .select('id, booking_id, booking_type, user_name, user_email, phone, passenger_count, start_datetime, pickup_date, pickup_time, destination_id, tour_package_id, car_model')
          .eq('booking_id', resolvedBookingId)
          .single()

        bookingDetails = booking || null

        if (booking?.destination_id) {
          const { data: destination } = await supabaseAdmin
            .from('destinations')
            .select('name')
            .eq('id', booking.destination_id)
            .single()
          destinationName = destination?.name || null
        }

        if (booking?.tour_package_id) {
          const { data: tour } = await supabaseAdmin
            .from('tour_packages')
            .select('name')
            .eq('id', booking.tour_package_id)
            .single()
          tourName = tour?.name || null
        }
      }

      return {
        ...paymentRow,
        payment_records: records ?? [],
        booking_details: bookingDetails,
        destination_name: destinationName,
        tour_name: tourName,
      }
    }

    // Try direct lookup first (covers rows where payments.booking_id equals provided value)
    const { data: directPayment, error: directError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('booking_id', bookingId)
      .single()

    if (!directError && directPayment) {
      const payload = await enrichPaymentResponse(directPayment, directPayment.booking_id || null)
      return Response.json(payload, { status: 200 })
    }

    // Fallback: bookingId may be DB UUID (bookings.id) while payment row stores bookings.booking_id
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('booking_id')
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking?.booking_id) {
      console.error('Error resolving booking identifier:', bookingError || 'booking not found')
      return Response.json(
        {
          success: false,
          error: 'Payment record not found',
        },
        { status: 404 }
      )
    }

    const { data: fallbackPayment, error: fallbackError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('booking_id', booking.booking_id)
      .single()

    if (fallbackError || !fallbackPayment) {
      console.error('Error fetching payment:', fallbackError || directError)
      return Response.json(
        {
          success: false,
          error: 'Payment record not found',
        },
        { status: 404 }
      )
    }

    const payload = await enrichPaymentResponse(fallbackPayment, booking.booking_id)
    return Response.json(payload, { status: 200 })
  } catch (error) {
    console.error('Error in get-payment route:', error)
    return Response.json(
      {
        success: false,
        error: 'Failed to fetch payment record',
      },
      { status: 500 }
    )
  }
}
