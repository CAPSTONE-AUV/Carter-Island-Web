import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { RegisterData } from '@/types/auth'
import { TimezoneUtil } from '@/lib/timezone'

export async function POST(request: NextRequest) {
  try {
    const body: RegisterData = await request.json()
    const { fullName, email, password, phoneNumber, role = 'USER' } = body

    // Validate input
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

    // Validate password minimum 6 characters
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

    // Create new user dengan Indonesia timezone
    const user = await prisma.user.create({
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

    // Log registration dengan Indonesia timestamp
    console.log(`[${TimezoneUtil.getTimestamp()}] New user registered: ${user.email} (${user.role})`)

    return NextResponse.json(
      { 
        message: 'Registration successful',
        user: {
          ...user,
          createdAt: TimezoneUtil.formatIndonesian(user.createdAt),
          updatedAt: TimezoneUtil.formatIndonesian(user.updatedAt)
        }
      },
      { status: 201 }
    )
  } catch (error) {
    console.error(`[${TimezoneUtil.getTimestamp()}] Registration error:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}