import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/auv-status/latest - Get the most recent AUV status
export async function GET() {
  try {
    const auvStatus = await prisma.aUVStatus.findFirst({
      orderBy: {
        timestamp: 'desc',
      },
    });

    if (!auvStatus) {
      return NextResponse.json(
        { error: 'No AUV status data available' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: auvStatus,
    });
  } catch (error) {
    console.error('Error fetching latest AUV status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch latest AUV status' },
      { status: 500 }
    );
  }
}
