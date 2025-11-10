import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/telemetry/latest - Get the most recent telemetry data
export async function GET() {
  try {
    const telemetry = await prisma.telemetry.findFirst({
      orderBy: {
        timestamp: 'desc',
      },
    });

    if (!telemetry) {
      return NextResponse.json(
        { error: 'No telemetry data available' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: telemetry,
    });
  } catch (error) {
    console.error('Error fetching latest telemetry:', error);
    return NextResponse.json(
      { error: 'Failed to fetch latest telemetry data' },
      { status: 500 }
    );
  }
}
