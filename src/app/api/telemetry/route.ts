import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/telemetry - Save telemetry data from Raspberry Pi
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const { compass, battery, health } = body;

    if (!compass || !battery || !health) {
      return NextResponse.json(
        { error: 'Missing required fields: compass, battery, health' },
        { status: 400 }
      );
    }

    // Save to database
    const telemetry = await prisma.telemetry.create({
      data: {
        yawDeg: compass.yaw_deg,
        voltageV: battery.voltage_v,
        currentA: battery.current_a,
        remainingPercent: battery.remaining_percent,
        gyroOk: health.gyro_ok,
        accelOk: health.accel_ok,
        magOk: health.mag_ok,
      },
    });

    return NextResponse.json({
      success: true,
      data: telemetry,
    });
  } catch (error) {
    console.error('Error saving telemetry data:', error);
    return NextResponse.json(
      { error: 'Failed to save telemetry data' },
      { status: 500 }
    );
  }
}

// GET /api/telemetry - Get telemetry data with pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    const telemetry = await prisma.telemetry.findMany({
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
      skip: offset,
    });

    const total = await prisma.telemetry.count();

    return NextResponse.json({
      success: true,
      data: telemetry,
      pagination: {
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Error fetching telemetry data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch telemetry data' },
      { status: 500 }
    );
  }
}
