import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/maintenance/cleanup
 * Cleanup old telemetry and AUV status data to prevent database bloat
 * Keeps data for the last 7 days only
 */
export async function GET() {
  try {
    // Calculate date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Delete old telemetry data
    const deletedTelemetry = await prisma.telemetry.deleteMany({
      where: {
        timestamp: {
          lt: sevenDaysAgo,
        },
      },
    });

    // Delete old AUV status data
    const deletedAUVStatus = await prisma.aUVStatus.deleteMany({
      where: {
        timestamp: {
          lt: sevenDaysAgo,
        },
      },
    });

    // Get current data counts
    const telemetryCount = await prisma.telemetry.count();
    const auvStatusCount = await prisma.aUVStatus.count();

    return NextResponse.json({
      success: true,
      data: {
        deletedTelemetryRecords: deletedTelemetry.count,
        deletedAUVStatusRecords: deletedAUVStatus.count,
        remainingTelemetryRecords: telemetryCount,
        remainingAUVStatusRecords: auvStatusCount,
        retentionPeriod: '7 days',
        cleanupDate: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Cleanup failed',
      },
      { status: 500 }
    );
  }
}
