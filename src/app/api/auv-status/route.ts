import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/auv-status - Save AUV status data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const { isOnline, connectionStrength, uptimeSeconds } = body;

    if (
      typeof isOnline !== 'boolean' ||
      !connectionStrength ||
      typeof uptimeSeconds !== 'number'
    ) {
      return NextResponse.json(
        { error: 'Missing or invalid required fields' },
        { status: 400 }
      );
    }

    // Save to database
    const auvStatus = await prisma.aUVStatus.create({
      data: {
        isOnline,
        connectionStrength,
        uptimeSeconds,
        locationStatus: body.locationStatus || 'Active',
        lastStreamTime: body.lastStreamTime
          ? new Date(body.lastStreamTime)
          : null,
      },
    });

    return NextResponse.json({
      success: true,
      data: auvStatus,
    });
  } catch (error) {
    console.error('Error saving AUV status:', error);
    return NextResponse.json(
      { error: 'Failed to save AUV status' },
      { status: 500 }
    );
  }
}

// GET /api/auv-status - Get AUV status data with pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    const statuses = await prisma.aUVStatus.findMany({
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
      skip: offset,
    });

    const total = await prisma.aUVStatus.count();

    return NextResponse.json({
      success: true,
      data: statuses,
      pagination: {
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Error fetching AUV status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AUV status' },
      { status: 500 }
    );
  }
}
