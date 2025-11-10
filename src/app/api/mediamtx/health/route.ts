import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const MEDIAMTX_PLAYER_URL = 'http://192.168.2.2:8889/cam/';

/**
 * Calculate connection strength based on response time
 */
function calculateConnectionStrength(responseTimeMs: number): string {
  if (responseTimeMs < 500) {
    return 'Strong'; // Very fast response
  } else if (responseTimeMs < 1500) {
    return 'Moderate'; // Acceptable response
  } else {
    return 'Weak'; // Slow response
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
 * GET /api/mediamtx/health
 * Check if MediaMTX player is accessible and update AUV status
 */
export async function GET() {
  const startTime = Date.now();
  let isOnline = false;
  let connectionStrength = 'Disconnected';
  let responseTime = 0;

  try {
    // Try to fetch MediaMTX player page with timeout
    const response = await fetch(MEDIAMTX_PLAYER_URL, {
      method: 'HEAD', // Use HEAD for faster response
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    responseTime = Date.now() - startTime;
    isOnline = response.ok; // true if status 2xx

    if (isOnline) {
      connectionStrength = calculateConnectionStrength(responseTime);
    }
  } catch (error) {
    // If fetch fails (network error, timeout, etc), treat as offline
    isOnline = false;
    connectionStrength = 'Disconnected';
    responseTime = Date.now() - startTime;
  }

  try {
    // Get the latest AUV status to check if we have a first connected time
    const latestStatus = await prisma.aUVStatus.findFirst({
      orderBy: { timestamp: 'desc' },
    });

    let firstConnectedTime: Date | null = null;

    if (isOnline) {
      // If currently online, use existing firstConnectedTime or set new one
      if (latestStatus?.isOnline && latestStatus.lastStreamTime) {
        // Was online before, keep the original first connected time
        firstConnectedTime = latestStatus.lastStreamTime;
      } else {
        // Just came online, set current time as first connected
        firstConnectedTime = new Date();
      }
    } else {
      // If offline, keep the last known first connected time for history
      // but uptime will be 0
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
        responseTimeMs: responseTime,
        mediaPlayerUrl: MEDIAMTX_PLAYER_URL,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (dbError) {
    console.error('Database error while updating AUV status:', dbError);

    // Still return the health check result even if DB save fails
    return NextResponse.json({
      success: true,
      data: {
        isOnline,
        connectionStrength,
        responseTimeMs: responseTime,
        mediaPlayerUrl: MEDIAMTX_PLAYER_URL,
        timestamp: new Date().toISOString(),
      },
      warning: 'Failed to save to database',
    });
  }
}
