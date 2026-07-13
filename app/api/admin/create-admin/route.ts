import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getJwtSecret } from '@/lib/admin-auth'

function verifyToken(token: string): any {
  try {
    return jwt.verify(token, getJwtSecret())
  } catch (error) {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    const decoded = verifyToken(token)

    if (!decoded) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or expired token' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { email, password, full_name, role = 'admin' } = body

    // Validate required fields
    if (!email || !password || !full_name) {
      return NextResponse.json(
        { error: 'Email, password, and full name are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const { data: existingAdmin, error: checkError } = await supabaseAdmin
      .from('admins')
      .select('id')
      .eq('email', email)
      .single()

    if (existingAdmin) {
      return NextResponse.json(
        { error: 'Email already exists in the system' },
        { status: 409 }
      )
    }

    // Hash password using bcryptjs (same as the script)
    const salt = await bcrypt.genSalt(10)
    const passwordHash = await bcrypt.hash(password, salt)

    // Insert new admin into database
    const { data: newAdmin, error: insertError } = await supabaseAdmin
      .from('admins')
      .insert({
        email,
        password_hash: passwordHash,
        full_name,
        role,
        is_active: true,
      })
      .select('id, email, full_name, role, created_at')
      .single()

    if (insertError || !newAdmin) {
      console.error('Error creating admin:', insertError)
      return NextResponse.json(
        { error: 'Failed to create admin account' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Admin account created successfully',
        admin: newAdmin,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create admin error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
