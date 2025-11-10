import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const RASPI_TELEMETRY_URL = 'http://192.168.2.2:14552/telemetry';

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
 * Compares attitude, compass, battery, and health values
 */
function isTelemetryDataChanging(current: any, previous: any): boolean {
  if (!previous) return true; // First time, consider as changing

  // Compare attitude values
  const attitudeChanged =
    current.attitude.roll_deg !== previous.rollDeg ||
    current.attitude.pitch_deg !== previous.pitchDeg ||
    current.attitude.yaw_deg !== previous.yawDeg;

  // Compare compass values
  const compassChanged = current.compass.heading_deg !== previous.headingDeg;

  // Compare battery values
  const batteryChanged =
    current.battery.voltage_v !== previous.voltageV ||
    current.battery.remaining_percent !== previous.remainingPercent;

  // Compare health calibration status
  const healthChanged =
    current.health.gyro_cal !== previous.gyroCal ||
    current.health.accel_cal !== previous.accelCal ||
    current.health.mag_cal !== previous.magCal;

  return attitudeChanged || compassChanged || batteryChanged || healthChanged;
}

/**
 * GET /api/health/check
 * Check AUV health based on telemetry data changes only
 * AUV is online if telemetry data is actively changing
 */
export async function GET() {
  let isTelemetryChanging = false;
  let telemetryData: any = null;

  try {
    // Fetch current telemetry data from Raspberry Pi
    try {
      const telemetryResponse = await fetch(RASPI_TELEMETRY_URL, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });

      if (telemetryResponse.ok) {
        telemetryData = await telemetryResponse.json();

        // Validate required fields - only use: attitude, compass, battery, health
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
              // Attitude
              rollDeg: telemetryData.attitude.roll_deg,
              pitchDeg: telemetryData.attitude.pitch_deg,
              yawDeg: telemetryData.attitude.yaw_deg,
              // Compass
              headingDeg: telemetryData.compass.heading_deg,
              // Battery
              voltageV: telemetryData.battery.voltage_v,
              currentA: telemetryData.battery.current_a,
              remainingPercent: telemetryData.battery.remaining_percent,
              consumedMah: telemetryData.battery.consumed_mAh,
              // Health
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

    // AUV is online ONLY if telemetry data is changing
    const isOnline = isTelemetryChanging;

    // Connection strength based on whether data is changing
    const connectionStrength = isOnline ? 'Strong' : 'Disconnected';

    // Update AUV status
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
          telemetryDataChanging: isTelemetryChanging,
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
          telemetryDataChanging: isTelemetryChanging,
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
