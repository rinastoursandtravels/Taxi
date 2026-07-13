import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { calculateRatingStats } from '@/lib/reviews'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const reviewableType = searchParams.get('reviewable_type')
    const reviewableId = searchParams.get('reviewable_id')

    if (!reviewableType || !reviewableId) {
      return NextResponse.json(
        { success: false, error: 'Missing reviewable_type or reviewable_id' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select('*')
      .eq('reviewable_type', reviewableType)
      .eq('reviewable_id', reviewableId)
      .eq('is_visible', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching reviews:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    const reviews = data || []
    const stats = calculateRatingStats(reviews)

    return NextResponse.json(
      { success: true, reviews, stats },
      { status: 200 }
    )
  } catch (error) {
    console.error('Exception in GET /api/reviews:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require a logged-in user. The reviewer's identity comes from the verified
    // session — not the request body — so nobody can post anonymously or under
    // someone else's email. (The review form is only shown to signed-in users.)
    const supabaseAuth = createRouteHandlerClient({ cookies })
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser()

    if (authError || !user?.email) {
      return NextResponse.json({ success: false, error: 'You must be signed in to leave a review' }, { status: 401 })
    }

    const body = await request.json()
    const { reviewableType, reviewableId, userName, rating, title, comment } = body

    // Identity is taken from the session, never the client payload.
    const userEmail = user.email
    const userId = user.id

    // Validate inputs
    if (!reviewableType || !reviewableId || !userName || !rating) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: 'Rating must be between 1 and 5' },
        { status: 400 }
      )
    }

    if (reviewableType !== 'tour' && reviewableType !== 'taxi_booking') {
      return NextResponse.json(
        { success: false, error: 'Invalid reviewable_type' },
        { status: 400 }
      )
    }

    // Insert the review
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .insert([
        {
          reviewable_type: reviewableType,
          reviewable_id: reviewableId,
          user_id: userId || null,
          user_email: userEmail,
          user_name: userName,
          rating,
          title: title || null,
          comment: comment || null,
          is_visible: true,
        }
      ])
      .select()

    if (error) {
      // Check for unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'You have already reviewed this item' },
          { status: 409 }
        )
      }

      console.error('Error creating review:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, review: data?.[0] },
      { status: 201 }
    )
  } catch (error) {
    console.error('Exception in POST /api/reviews:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
