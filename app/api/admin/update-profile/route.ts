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

export async function PUT(request: NextRequest) {
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
    const { full_name, email, currentPassword, newPassword } = body

    // At least one field must be provided
    if (!full_name && !email && !newPassword) {
      return NextResponse.json(
        { error: 'At least one field (name, email, or password) must be provided' },
        { status: 400 }
      )
    }

    // Fetch current admin
    const { data: admin, error: fetchError } = await supabaseAdmin
      .from('admins')
      .select('*')
      .eq('id', decoded.id)
      .single()

    if (fetchError || !admin) {
      return NextResponse.json(
        { error: 'Admin not found' },
        { status: 404 }
      )
    }

    // If password is being changed, verify current password
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Current password is required to change password' },
          { status: 400 }
        )
      }

      // Verify current password
      const passwordMatch = await bcrypt.compare(currentPassword, admin.password_hash)
      if (!passwordMatch) {
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 401 }
        )
      }

      // Validate new password length
      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: 'New password must be at least 8 characters long' },
          { status: 400 }
        )
      }
    }

    // Validate email if being changed
    if (email && email !== admin.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        )
      }

      // Check if new email already exists
      const { data: existingAdmin } = await supabaseAdmin
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
    }

    // Prepare update object
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (full_name && full_name !== admin.full_name) {
      updateData.full_name = full_name
    }

    if (email && email !== admin.email) {
      updateData.email = email
    }

    if (newPassword) {
      const salt = await bcrypt.genSalt(10)
      updateData.password_hash = await bcrypt.hash(newPassword, salt)
    }

    // Update admin
    const { data: updatedAdmin, error: updateError } = await supabaseAdmin
      .from('admins')
      .update(updateData)
      .eq('id', decoded.id)
      .select('id, email, full_name, role, updated_at')
      .single()

    if (updateError || !updatedAdmin) {
      console.error('Error updating admin:', updateError)
      return NextResponse.json(
        { error: 'Failed to update admin profile' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Profile updated successfully',
        admin: updatedAdmin,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Update admin profile error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
