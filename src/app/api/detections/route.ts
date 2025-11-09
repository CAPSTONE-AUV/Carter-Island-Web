import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Interface untuk data deteksi dari Python backend
interface DetectionDetailData {
  className: string;
  confidence: number;
  boundingBox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

interface FishDetectionRequest {
  sessionId?: string;
  timestamp?: string;
  fishCount: number;
  frameNumber?: number;
  imageUrl?: string;
  detections: DetectionDetailData[];
}

// POST /api/detections - Simpan hasil deteksi ikan dari YOLO
export async function POST(req: NextRequest) {
  try {
    const body: FishDetectionRequest = await req.json();

    // Validasi data
    if (typeof body.fishCount !== "number" || body.fishCount < 0) {
      return NextResponse.json(
        { error: "fishCount harus berupa angka positif" },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.detections)) {
      return NextResponse.json(
        { error: "detections harus berupa array" },
        { status: 400 }
      );
    }

    // Simpan deteksi ke database menggunakan transaction
    const result = await prisma.fishDetection.create({
      data: {
        sessionId: body.sessionId || null,
        timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
        fishCount: body.fishCount,
        frameNumber: body.frameNumber || null,
        imageUrl: body.imageUrl || null,
        detectionDetails: {
          create: body.detections.map((detection) => ({
            className: detection.className,
            confidence: detection.confidence,
            boundingBoxX1: detection.boundingBox.x1,
            boundingBoxY1: detection.boundingBox.y1,
            boundingBoxX2: detection.boundingBox.x2,
            boundingBoxY2: detection.boundingBox.y2,
          })),
        },
      },
      include: {
        detectionDetails: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Deteksi berhasil disimpan",
        data: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error saving detection:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Gagal menyimpan deteksi",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET /api/detections - Dapatkan daftar deteksi dengan pagination
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const sessionId = searchParams.get("sessionId");
    const className = searchParams.get("className");

    const skip = (page - 1) * limit;

    // Build filter
    const where: any = {};
    if (sessionId) {
      where.sessionId = sessionId;
    }
    if (className) {
      where.detectionDetails = {
        some: {
          className: {
            contains: className,
          },
        },
      };
    }

    // Get total count
    const total = await prisma.fishDetection.count({ where });

    // Get detections
    const detections = await prisma.fishDetection.findMany({
      where,
      include: {
        detectionDetails: true,
      },
      orderBy: {
        timestamp: "desc",
      },
      skip,
      take: limit,
    });

    return NextResponse.json({
      success: true,
      data: detections,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching detections:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Gagal mengambil data deteksi",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
