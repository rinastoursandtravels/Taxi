import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { logSystemEvent } from '@/lib/system-events'
import { getJwtSecret } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Fetch admin from database
    const { data: admin, error } = await supabaseAdmin
      .from('admins')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single()

    if (error || !admin) {
      await logSystemEvent({
        severity: 'security',
        event_type: 'admin_login_failed',
        actor_type: 'admin',
        actor_label: email || null,
        message: 'Admin login failed due to invalid credentials',
      })
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, admin.password_hash)

    if (!passwordMatch) {
      await logSystemEvent({
        severity: 'security',
        event_type: 'admin_login_failed',
        actor_type: 'admin',
        actor_label: email || null,
        message: 'Admin login failed due to invalid credentials',
      })
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Update last login
    await supabaseAdmin
      .from('admins')
      .update({ last_login: new Date().toISOString() })
      .eq('id', admin.id)

    // Create JWT token (expires in 24 hours)
    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        full_name: admin.full_name,
        role: admin.role,
      },
      getJwtSecret(),
      { expiresIn: '24h' }
    )

    await logSystemEvent({
      severity: 'info',
      event_type: 'admin_login_success',
      actor_type: 'admin',
      actor_id: admin.id,
      actor_label: admin.email,
      entity_type: 'admin',
      entity_id: admin.id,
      message: 'Admin login successful',
      metadata: { role: admin.role || null },
    })

    return NextResponse.json(
      {
        success: true,
        token,
        admin: {
          id: admin.id,
          email: admin.email,
          full_name: admin.full_name,
          role: admin.role,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Admin login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
