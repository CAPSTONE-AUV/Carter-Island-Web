import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/detections/stats - Dapatkan statistik deteksi ikan
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const sessionId = searchParams.get("sessionId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build filter
    const where: any = {};
    if (sessionId) {
      where.sessionId = sessionId;
    }
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    }

    // Get total detections
    const totalDetections = await prisma.fishDetection.count({ where });

    // Get total fish count
    const fishCountSum = await prisma.fishDetection.aggregate({
      where,
      _sum: {
        fishCount: true,
      },
    });

    // Get detections by class
    const detectionsByClass = await prisma.detectionDetail.groupBy({
      by: ["className"],
      where: sessionId
        ? {
            detection: {
              sessionId,
            },
          }
        : startDate || endDate
        ? {
            detection: {
              timestamp: where.timestamp,
            },
          }
        : undefined,
      _count: {
        className: true,
      },
      _avg: {
        confidence: true,
      },
      orderBy: {
        _count: {
          className: "desc",
        },
      },
    });

    // Get average confidence
    const avgConfidence = await prisma.detectionDetail.aggregate({
      where: sessionId
        ? {
            detection: {
              sessionId,
            },
          }
        : startDate || endDate
        ? {
            detection: {
              timestamp: where.timestamp,
            },
          }
        : undefined,
      _avg: {
        confidence: true,
      },
    });

    // Get recent detections (last 10)
    const recentDetections = await prisma.fishDetection.findMany({
      where,
      include: {
        detectionDetails: {
          select: {
            className: true,
            confidence: true,
          },
        },
      },
      orderBy: {
        timestamp: "desc",
      },
      take: 10,
    });

    return NextResponse.json({
      success: true,
      data: {
        totalDetections,
        totalFishCount: fishCountSum._sum.fishCount || 0,
        averageConfidence: avgConfidence._avg.confidence || 0,
        detectionsByClass: detectionsByClass.map((item) => ({
          className: item.className,
          count: item._count.className,
          avgConfidence: item._avg.confidence || 0,
        })),
        recentDetections: recentDetections.map((detection) => ({
          id: detection.id,
          timestamp: detection.timestamp,
          fishCount: detection.fishCount,
          classes: detection.detectionDetails.map((d) => d.className),
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching detection stats:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Gagal mengambil statistik deteksi",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
