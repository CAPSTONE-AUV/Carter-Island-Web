import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const MEDIAMTX_PLAYER_URL = 'http://192.168.2.2:8889/cam/';
const RASPI_TELEMETRY_URL = 'http://192.168.2.2:14552/telemetry';

/**
 * Calculate connection strength based on response time
 */
function calculateConnectionStrength(responseTimeMs: number): string {
  if (responseTimeMs < 500) {
    return 'Strong';
  } else if (responseTimeMs < 1500) {
    return 'Moderate';
  } else {
    return 'Weak';
  }
}

/**
 * Calculate uptime in seconds from first connected time
 */
function calculateUptime(firstConnectedTime: Date | null): number {
  if (!firstConnectedTime) return 0;

  const now = new Date();
  const diffMs = now.getTime() - firstConnectedTime.getTime();
  return Math.floor(diffMs / 1000);
}

/**
 * Check if telemetry data has changed from previous reading
 * Compares attitude and compass values
 */
function isTelemetryDataChanging(
  current: any,
  previous: any
): boolean {
  if (!previous) return true; // First time, consider as changing

  // Compare critical values (attitude and compass)
  const attitudeChanged =
    current.attitude.roll_deg !== previous.rollDeg ||
    current.attitude.pitch_deg !== previous.pitchDeg ||
    current.attitude.yaw_deg !== previous.yawDeg;

  const compassChanged =
    current.compass.heading_deg !== previous.headingDeg;

  return attitudeChanged || compassChanged;
}

/**
 * GET /api/health/check
 * Comprehensive health check:
 * 1. Check MediaMTX player accessibility
 * 2. Fetch and check if telemetry data is changing
 * 3. Update AUV status based on both conditions
 */
export async function GET() {
  let isMediaMTXAccessible = false;
  let isTelemetryChanging = false;
  let mediaResponseTime = 0;
  let telemetryData: any = null;

  try {
    // 1. Check MediaMTX player accessibility
    const mediaStartTime = Date.now();
    try {
      const mediaResponse = await fetch(MEDIAMTX_PLAYER_URL, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      mediaResponseTime = Date.now() - mediaStartTime;
      isMediaMTXAccessible = mediaResponse.ok;
    } catch (error) {
      isMediaMTXAccessible = false;
      mediaResponseTime = Date.now() - mediaStartTime;
    }

    // 2. Fetch current telemetry data
    try {
      const telemetryResponse = await fetch(RASPI_TELEMETRY_URL, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });

      if (telemetryResponse.ok) {
        telemetryData = await telemetryResponse.json();

        // Validate required fields
        if (
          telemetryData?.attitude &&
          telemetryData?.compass &&
          telemetryData?.battery &&
          telemetryData?.health
        ) {
          // Get previous telemetry to compare
          const previousTelemetry = await prisma.telemetry.findFirst({
            orderBy: { timestamp: 'desc' },
          });

          // Check if data is changing
          isTelemetryChanging = isTelemetryDataChanging(
            telemetryData,
            previousTelemetry
          );

          // Save new telemetry to database
          await prisma.telemetry.create({
            data: {
              rollDeg: telemetryData.attitude.roll_deg,
              pitchDeg: telemetryData.attitude.pitch_deg,
              yawDeg: telemetryData.attitude.yaw_deg,
              headingDeg: telemetryData.compass.heading_deg,
              voltageV: telemetryData.battery.voltage_v,
              currentA: telemetryData.battery.current_a,
              remainingPercent: telemetryData.battery.remaining_percent,
              consumedMah: telemetryData.battery.consumed_mAh,
              gyroCal: telemetryData.health.gyro_cal,
              accelCal: telemetryData.health.accel_cal,
              magCal: telemetryData.health.mag_cal,
            },
          });
        }
      }
    } catch (error) {
      console.error('Error fetching telemetry:', error);
      isTelemetryChanging = false;
    }

    // 3. Determine overall online status
    // AUV is online ONLY if BOTH conditions are met:
    // - MediaMTX player is accessible
    // - Telemetry data is changing
    const isOnline = isMediaMTXAccessible && isTelemetryChanging;

    // 4. Calculate connection strength (based on MediaMTX response time)
    const connectionStrength = isOnline
      ? calculateConnectionStrength(mediaResponseTime)
      : 'Disconnected';

    // 5. Update AUV status
    try {
      const latestStatus = await prisma.aUVStatus.findFirst({
        orderBy: { timestamp: 'desc' },
      });

      let firstConnectedTime: Date | null = null;

      if (isOnline) {
        // If currently online, use existing firstConnectedTime or set new one
        if (latestStatus?.isOnline && latestStatus.lastStreamTime) {
          firstConnectedTime = latestStatus.lastStreamTime;
        } else {
          firstConnectedTime = new Date();
        }
      } else {
        // If offline, keep the last known first connected time
        firstConnectedTime = latestStatus?.lastStreamTime || null;
      }

      const uptime = isOnline ? calculateUptime(firstConnectedTime) : 0;

      // Save current status to database
      await prisma.aUVStatus.create({
        data: {
          isOnline,
          connectionStrength,
          uptimeSeconds: uptime,
          locationStatus: 'Active',
          lastStreamTime: firstConnectedTime,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          isOnline,
          connectionStrength,
          uptimeSeconds: uptime,
          mediaPlayerAccessible: isMediaMTXAccessible,
          telemetryDataChanging: isTelemetryChanging,
          mediaResponseTimeMs: mediaResponseTime,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (dbError) {
      console.error('Database error while updating AUV status:', dbError);

      return NextResponse.json({
        success: true,
        data: {
          isOnline,
          connectionStrength,
          mediaPlayerAccessible: isMediaMTXAccessible,
          telemetryDataChanging: isTelemetryChanging,
          mediaResponseTimeMs: mediaResponseTime,
          timestamp: new Date().toISOString(),
        },
        warning: 'Failed to save to database',
      });
    }
  } catch (error) {
    console.error('Error in health check:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Health check failed',
      },
      { status: 500 }
    );
  }
}
