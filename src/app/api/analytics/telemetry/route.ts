import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/analytics/telemetry
 * Get telemetry analytics data
 * Query params:
 *  - hours: number of hours to look back (default: 24)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get('hours') || '24');

    // Calculate start time
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);

    // Get telemetry data
    const telemetry = await prisma.telemetry.findMany({
      where: {
        timestamp: {
          gte: startTime,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
      // Sample data: take every 10th record to avoid too many points
      take: 288, // 24 hours * 12 points per hour (5 min intervals)
    });

    // Format for charts
    const batteryData = telemetry.map((t) => ({
      time: t.timestamp.toISOString(),
      voltage: parseFloat(t.voltageV.toFixed(2)),
      remaining: parseFloat(t.remainingPercent.toFixed(1)),
    }));

    const attitudeData = telemetry.map((t) => ({
      time: t.timestamp.toISOString(),
      roll: parseFloat(t.rollDeg.toFixed(1)),
      pitch: parseFloat(t.pitchDeg.toFixed(1)),
      yaw: parseFloat(t.yawDeg.toFixed(1)),
    }));

    const compassData = telemetry.map((t) => ({
      time: t.timestamp.toISOString(),
      heading: parseFloat(t.headingDeg.toFixed(1)),
    }));

    const healthData = telemetry.map((t) => ({
      time: t.timestamp.toISOString(),
      gyro: t.gyroCal ? 1 : 0,
      accel: t.accelCal ? 1 : 0,
      mag: t.magCal ? 1 : 0,
    }));

    // Calculate stats
    const latest = telemetry[telemetry.length - 1];
    const avgBattery =
      telemetry.reduce((sum, t) => sum + t.remainingPercent, 0) /
      (telemetry.length || 1);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          currentBattery: latest
            ? latest.remainingPercent.toFixed(1)
            : 'N/A',
          avgBattery: avgBattery.toFixed(1),
          currentVoltage: latest ? latest.voltageV.toFixed(2) : 'N/A',
          dataPoints: telemetry.length,
        },
        battery: batteryData,
        attitude: attitudeData,
        compass: compassData,
        health: healthData,
      },
    });
  } catch (error) {
    console.error('Error fetching telemetry analytics:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch telemetry analytics',
      },
      { status: 500 }
    );
  }
}
