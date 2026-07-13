import { supabaseAdmin } from '@/lib/supabase-admin'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Derive the identity from the verified Supabase session, never from the
    // request body. This guarantees a logged-in user can only ever read their
    // OWN bookings — the previous version returned every booking for whatever
    // email was posted, with no authentication at all.
    const supabaseAuth = createRouteHandlerClient({ cookies })
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser()

    if (authError || !user?.email) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('user_email', user.email)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching bookings:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, bookings: data || [] })
  } catch (error) {
    console.error('Bookings fetch error:', error)
    return Response.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }
}
