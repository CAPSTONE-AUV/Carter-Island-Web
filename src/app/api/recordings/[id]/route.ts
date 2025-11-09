import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/recordings/[id] - Get a specific recording by ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "Recording ID wajib diisi" },
        { status: 400 }
      );
    }

    const recording = await prisma.recording.findUnique({
      where: { id },
    });

    if (!recording) {
      return NextResponse.json(
        { error: "Recording tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...recording,
        fileSize: recording.fileSize.toString(), // Convert BigInt to string
      },
    });
  } catch (error) {
    console.error("Error fetching recording:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Gagal mengambil data recording",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE /api/recordings/[id] - Delete a specific recording
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "Recording ID wajib diisi" },
        { status: 400 }
      );
    }

    // Delete from database
    await prisma.recording.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Recording berhasil dihapus",
    });
  } catch (error) {
    console.error("Error deleting recording:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Gagal menghapus recording",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
