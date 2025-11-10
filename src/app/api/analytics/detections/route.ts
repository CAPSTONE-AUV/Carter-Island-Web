import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/analytics/detections
 * Get fish detection analytics data
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

    // Get detection summary
    const detections = await prisma.fishDetection.findMany({
      where: {
        timestamp: {
          gte: startTime,
        },
      },
      include: {
        detectionDetails: true,
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    // Aggregate by hour
    const hourlyData: Record<string, { count: number; totalFish: number }> = {};
    const speciesData: Record<string, number> = {};

    detections.forEach((detection) => {
      // Group by hour
      const hour = new Date(detection.timestamp);
      hour.setMinutes(0, 0, 0);
      const hourKey = hour.toISOString();

      if (!hourlyData[hourKey]) {
        hourlyData[hourKey] = { count: 0, totalFish: 0 };
      }
      hourlyData[hourKey].count += 1;
      hourlyData[hourKey].totalFish += detection.fishCount;

      // Count by species
      detection.detectionDetails.forEach((detail) => {
        speciesData[detail.className] =
          (speciesData[detail.className] || 0) + 1;
      });
    });

    // Format for charts
    const timeSeriesData = Object.entries(hourlyData).map(
      ([time, data]) => ({
        time,
        detections: data.count,
        fishCount: data.totalFish,
      })
    );

    const speciesChartData = Object.entries(speciesData).map(
      ([species, count]) => ({
        species,
        count,
      })
    );

    // Calculate stats
    const totalDetections = detections.length;
    const totalFish = detections.reduce((sum, d) => sum + d.fishCount, 0);
    const avgConfidence =
      detections.reduce((sum, d) => {
        const avgConf =
          d.detectionDetails.reduce((s, det) => s + det.confidence, 0) /
          (d.detectionDetails.length || 1);
        return sum + avgConf;
      }, 0) / (detections.length || 1);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalDetections,
          totalFish,
          avgConfidence: avgConfidence.toFixed(2),
          uniqueSpecies: Object.keys(speciesData).length,
        },
        timeSeries: timeSeriesData,
        speciesDistribution: speciesChartData,
      },
    });
  } catch (error) {
    console.error('Error fetching detection analytics:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch detection analytics',
      },
      { status: 500 }
    );
  }
}
