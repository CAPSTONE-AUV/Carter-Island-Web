import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const RASPI_TELEMETRY_URL = 'http://192.168.2.2:14552/telemetry';

// GET /api/telemetry/fetch - Fetch telemetry from Raspberry Pi and save to database
export async function GET() {
  try {
    // Fetch telemetry data from Raspberry Pi
    const response = await fetch(RASPI_TELEMETRY_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch from Raspberry Pi: ${response.status}`
      );
    }

    const data = await response.json();

    // Validate required fields
    if (!data.compass || !data.battery || !data.health) {
      throw new Error('Invalid telemetry data from Raspberry Pi');
    }

    // Save to database
    const telemetry = await prisma.telemetry.create({
      data: {
        yawDeg: data.compass.yaw_deg,
        voltageV: data.battery.voltage_v,
        currentA: data.battery.current_a,
        remainingPercent: data.battery.remaining_percent,
        gyroOk: data.health.gyro_ok,
        accelOk: data.health.accel_ok,
        magOk: data.health.mag_ok,
      },
    });

    return NextResponse.json({
      success: true,
      data: telemetry,
      source: 'raspberry-pi',
    });
  } catch (error) {
    console.error('Error fetching telemetry from Raspberry Pi:', error);

    // Return error but don't crash
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch telemetry from Raspberry Pi',
      },
      { status: 500 }
    );
  }
}
