// src/app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { TimezoneUtil } from '@/lib/timezone'

// GET - Fetch all users (Admin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      )
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        role: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const formattedUsers = users.map(user => ({
      ...user,
      createdAt: TimezoneUtil.formatIndonesian(user.createdAt),
      updatedAt: TimezoneUtil.formatIndonesian(user.updatedAt)
    }))

    return NextResponse.json(formattedUsers)
  } catch (error) {
    console.error(`[${TimezoneUtil.getTimestamp()}] Get users error:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create new user (Admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { fullName, email, password, phoneNumber, role = 'USER' } = body

    // Validate required fields
    if (!fullName || !email || !password || !phoneNumber) {
      return NextResponse.json(
        { error: 'All fields are required' },
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

    // Validate password
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)
    const currentTime = TimezoneUtil.now()

    // Create new user
    const newUser = await prisma.user.create({
      data: {
        fullName,
        email,
        password: hashedPassword,
        phoneNumber,
        role: role as 'USER' | 'ADMIN',
        createdAt: currentTime,
        updatedAt: currentTime
      },
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

    console.log(`[${TimezoneUtil.getTimestamp()}] User created by admin: ${newUser.email} (${newUser.role})`)

    return NextResponse.json({
      message: 'User created successfully',
      user: {
        ...newUser,
        createdAt: TimezoneUtil.formatIndonesian(newUser.createdAt),
        updatedAt: TimezoneUtil.formatIndonesian(newUser.updatedAt)
      }
    }, { status: 201 })

  } catch (error) {
    console.error(`[${TimezoneUtil.getTimestamp()}] Create user error:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}