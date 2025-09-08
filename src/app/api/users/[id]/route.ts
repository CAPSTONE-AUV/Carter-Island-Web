// src/app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { TimezoneUtil } from '@/lib/timezone'

// GET - Get single user (Admin only)
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

    const formattedUser = {
      ...user,
      createdAt: TimezoneUtil.formatIndonesian(user.createdAt),
      updatedAt: TimezoneUtil.formatIndonesian(user.updatedAt)
    }

    return NextResponse.json(formattedUser)
  } catch (error) {
    console.error(`[${TimezoneUtil.getTimestamp()}] Get user error:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update user (Admin only)
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

    // Validate required fields
    if (!fullName || !email || !phoneNumber) {
      return NextResponse.json(
        { error: 'Full name, email, and phone number are required' },
        { status: 400 }
      )
    }

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

    // Check if email is already taken by another user
    if (email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email }
      })

      if (emailExists) {
        return NextResponse.json(
          { error: 'Email is already registered' },
          { status: 400 }
        )
      }
    }

    // Prepare update data
    const updateData: any = {
      fullName,
      email,
      phoneNumber,
      role: role || 'USER'
    }

    // Hash password if provided
    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 12)
      updateData.password = hashedPassword
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
        updatedAt: true
      }
    })

    console.log(`[${TimezoneUtil.getTimestamp()}] User updated: ${updatedUser.id} by admin: ${session.user.id}`)

    return NextResponse.json({
      message: 'User updated successfully',
      user: {
        ...updatedUser,
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

// DELETE - Delete user (Admin only)
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

    // Prevent self-deletion
    if (params.id === session.user.id) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 }
      )
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, fullName: true, email: true }
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

    console.log(`[${TimezoneUtil.getTimestamp()}] User deleted: ${user.id} (${user.email}) by admin: ${session.user.id}`)

    return NextResponse.json({
      message: `User "${user.fullName}" has been deleted successfully`
    })

  } catch (error) {
    console.error(`[${TimezoneUtil.getTimestamp()}] Delete user error:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}