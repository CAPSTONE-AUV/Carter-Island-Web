// src/app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { TimezoneUtil } from '@/lib/timezone'

// GET - Get single user by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ...user,
      createdAt: TimezoneUtil.formatIndonesian(user.createdAt),
      updatedAt: TimezoneUtil.formatIndonesian(user.updatedAt)
    })

  } catch (error) {
    console.error(`[${TimezoneUtil.getTimestamp()}] Get user error:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update user
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { fullName, email, password, phoneNumber, role } = body

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id }
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Validate required fields
    if (!fullName || !email || !phoneNumber) {
      return NextResponse.json(
        { error: 'Full name, email, and phone number are required' },
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

    // Check if email is taken by another user
    if (email !== existingUser.email) {
      const emailTaken = await prisma.user.findFirst({
        where: { 
          email,
          id: { not: params.id }
        }
      })

      if (emailTaken) {
        return NextResponse.json(
          { error: 'Email already registered' },
          { status: 409 }
        )
      }
    }

    // Prepare update data
    const updateData: any = {
      fullName,
      email,
      phoneNumber,
      role: role as 'USER' | 'ADMIN',
      updatedAt: TimezoneUtil.now()
    }

    // Hash new password if provided
    if (password && password.trim() !== '') {
      if (password.length < 6) {
        return NextResponse.json(
          { error: 'Password must be at least 6 characters long' },
          { status: 400 }
        )
      }
      updateData.password = await bcrypt.hash(password, 12)
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    })

    console.log(`[${TimezoneUtil.getTimestamp()}] User updated by admin: ${updatedUser.email}`)

    return NextResponse.json({
      message: 'User updated successfully',
      user: {
        ...updatedUser,
        createdAt: TimezoneUtil.formatIndonesian(updatedUser.createdAt),
        updatedAt: TimezoneUtil.formatIndonesian(updatedUser.updatedAt)
      }
    })

  } catch (error) {
    console.error(`[${TimezoneUtil.getTimestamp()}] Update user error:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      )
    }

    // Prevent admin from deleting themselves
    if (session.user.id === params.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: params.id }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Delete user
    await prisma.user.delete({
      where: { id: params.id }
    })

    console.log(`[${TimezoneUtil.getTimestamp()}] User deleted by admin: ${user.email}`)

    return NextResponse.json({
      message: 'User deleted successfully'
    })

  } catch (error) {
    console.error(`[${TimezoneUtil.getTimestamp()}] Delete user error:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}