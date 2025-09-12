// src/app/api/detection/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Interface untuk type safety
interface FishDetectionData {
  fishName: string
  confidence: number
  bbox: number[]
}

interface DetectionRequestBody {
  timestamp: string
  fishCount: number
  detections: FishDetectionData[]
}

export async function POST(request: NextRequest) {
  try {
    const body: DetectionRequestBody = await request.json()
    const { timestamp, fishCount, detections } = body

    // Validasi input
    if (!timestamp || fishCount === undefined || !Array.isArray(detections)) {
      return NextResponse.json(
        { error: 'Missing required fields: timestamp, fishCount, detections' }, 
        { status: 400 }
      )
    }

    // Simpan detection record ke MySQL
    const detection = await prisma.detection.create({
      data: {
        timestamp: new Date(timestamp),
        fishCount: fishCount,
        results: JSON.stringify(detections),
      }
    })

    // Simpan detail setiap ikan yang terdeteksi (jika ada)
    if (detections && detections.length > 0) {
      const fishDetectionData = detections.map((fish) => ({
        detectionId: detection.id,
        fishName: fish.fishName || 'unknown',
        confidence: fish.confidence || 0,
        boundingBox: JSON.stringify(fish.bbox || [])
      }))

      await prisma.fishDetection.createMany({
        data: fishDetectionData
      })
    }

    return NextResponse.json({ 
      success: true, 
      id: detection.id,
      message: 'Detection saved successfully'
    })

  } catch (error) {
    console.error('Database error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to save detection', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

export async function GET() {
  try {
    const detections = await prisma.detection.findMany({
      include: {
        fishDetections: {
          select: {
            fishName: true,
            confidence: true,
            boundingBox: true
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 50
    })

    const formattedDetections = detections.map(detection => ({
      id: detection.id,
      timestamp: detection.timestamp,
      fishCount: detection.fishCount,
      results: detection.results,
      fishDetections: detection.fishDetections.map(fish => ({
        fishName: fish.fishName,
        confidence: fish.confidence,
        boundingBox: fish.boundingBox
      }))
    }))

    return NextResponse.json(formattedDetections)

  } catch (error) {
    console.error('Database error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch detections' }, 
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}