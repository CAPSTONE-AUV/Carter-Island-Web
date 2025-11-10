import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/analytics/auv-status
 * Get AUV status analytics data
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

    // Get AUV status data
    const statusData = await prisma.aUVStatus.findMany({
      where: {
        timestamp: {
          gte: startTime,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
      take: 288, // Sample data
    });

    // Format for charts
    const statusHistory = statusData.map((s) => ({
      time: s.timestamp.toISOString(),
      online: s.isOnline ? 1 : 0,
      uptime: s.uptimeSeconds,
      connection: s.connectionStrength,
    }));

    const uptimeData = statusData.map((s) => ({
      time: s.timestamp.toISOString(),
      uptime: Math.floor(s.uptimeSeconds / 60), // Convert to minutes
    }));

    // Calculate connection quality distribution
    const connectionStats: Record<string, number> = {};
    statusData.forEach((s) => {
      connectionStats[s.connectionStrength] =
        (connectionStats[s.connectionStrength] || 0) + 1;
    });

    const connectionDistribution = Object.entries(connectionStats).map(
      ([status, count]) => ({
        status,
        count,
      })
    );

    // Calculate uptime percentage
    const onlineCount = statusData.filter((s) => s.isOnline).length;
    const uptimePercentage = (
      (onlineCount / (statusData.length || 1)) *
      100
    ).toFixed(1);

    // Calculate average uptime
    const avgUptime =
      statusData.reduce((sum, s) => sum + s.uptimeSeconds, 0) /
      (statusData.length || 1);
    const avgUptimeMinutes = Math.floor(avgUptime / 60);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          uptimePercentage,
          avgUptimeMinutes,
          totalStatusChecks: statusData.length,
          currentlyOnline: statusData[statusData.length - 1]?.isOnline || false,
        },
        statusHistory,
        uptimeHistory: uptimeData,
        connectionDistribution,
      },
    });
  } catch (error) {
    console.error('Error fetching AUV status analytics:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch AUV status analytics',
      },
      { status: 500 }
    );
  }
}
