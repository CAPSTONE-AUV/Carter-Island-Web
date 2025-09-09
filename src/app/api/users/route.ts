// src/app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { TimezoneUtil } from '@/lib/timezone'
import { Role } from '@prisma/client'

// GET - Fetch users with cursor pagination (Admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    
    // Pagination parameters
    const cursor = searchParams.get('cursor') // ID dari item terakhir
    const limit = parseInt(searchParams.get('limit') || '10')
    const sortOrder = (searchParams.get('sort') || 'desc') as 'asc' | 'desc'
    
    // Filter parameters
    const role = searchParams.get('role') as Role | null
    const search = searchParams.get('search') // untuk search fullName atau email

    // Validasi limit (max 50)
    const validLimit = Math.min(Math.max(limit, 1), 50)

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {}
    
    // Role filter
    if (role && ['USER', 'ADMIN'].includes(role)) {
      whereClause.role = role
    }
    
    // Search filter
    if (search) {
      whereClause.OR = [
        { fullName: { contains: search} },
        { email: { contains: search } }
      ]
    }

    // Build cursor condition
    if (cursor) {
      whereClause.id = {
        [sortOrder === 'desc' ? 'lt' : 'gt']: cursor
      }
    }

    // Query users dengan cursor pagination
    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        role: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: [
        { createdAt: sortOrder },
        { id: sortOrder } // Secondary sort untuk consistency
      ],
      take: validLimit + 1 // Ambil 1 lebih untuk cek hasMore
    })

    // Tentukan hasMore dan nextCursor
    const hasMore = users.length > validLimit
    const items = hasMore ? users.slice(0, validLimit) : users
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null

    // Format tanggal
    const formattedUsers = items.map(user => ({
      ...user,
      createdAt: TimezoneUtil.formatIndonesian(user.createdAt),
      updatedAt: TimezoneUtil.formatIndonesian(user.updatedAt)
    }))

    return NextResponse.json({
      items: formattedUsers,
      nextCursor,
      hasMore,
      pagination: {
        limit: validLimit,
        total: items.length,
        sortOrder,
        filters: {
          role: role || null,
          search: search || null
        }
      }
    })

  } catch (error) {
    console.error(`[${TimezoneUtil.getTimestamp()}] Get users error:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST method tetap sama seperti yang sudah ada
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

    // Check if user already exists
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bcrypt = require('bcryptjs')
    const hashedPassword = await bcrypt.hash(password, 12)
    const currentTime = TimezoneUtil.now()

    // Create user
    const newUser = await prisma.user.create({
      data: {
        fullName,
        email,
        password: hashedPassword,
        phoneNumber,
        role: role as Role,
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

    console.log(`[${TimezoneUtil.getTimestamp()}] New user created: ${newUser.email} (${newUser.role})`)

    return NextResponse.json(
      { 
        message: 'User created successfully',
        user: {
          ...newUser,
          createdAt: TimezoneUtil.formatIndonesian(newUser.createdAt),
          updatedAt: TimezoneUtil.formatIndonesian(newUser.updatedAt)
        }
      },
      { status: 201 }
    )

  } catch (error) {
    console.error(`[${TimezoneUtil.getTimestamp()}] Create user error:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}