import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Interface untuk data recording dari Python backend
interface RecordingRequest {
  sessionId: string;
  filename: string;
  filepath: string;
  fileSize: number;
  duration: number;
  startTime: string;
  endTime: string;
}

// POST /api/recordings - Simpan data recording
export async function POST(req: NextRequest) {
  try {
    const body: RecordingRequest = await req.json();

    // Validasi data
    if (!body.sessionId || typeof body.sessionId !== "string") {
      return NextResponse.json(
        { error: "sessionId wajib diisi" },
        { status: 400 }
      );
    }

    if (!body.filename || typeof body.filename !== "string") {
      return NextResponse.json(
        { error: "filename wajib diisi" },
        { status: 400 }
      );
    }

    if (!body.filepath || typeof body.filepath !== "string") {
      return NextResponse.json(
        { error: "filepath wajib diisi" },
        { status: 400 }
      );
    }

    if (typeof body.fileSize !== "number" || body.fileSize < 0) {
      return NextResponse.json(
        { error: "fileSize harus berupa angka positif" },
        { status: 400 }
      );
    }

    if (typeof body.duration !== "number" || body.duration < 0) {
      return NextResponse.json(
        { error: "duration harus berupa angka positif" },
        { status: 400 }
      );
    }

    // Simpan recording ke database
    const result = await prisma.recording.create({
      data: {
        sessionId: body.sessionId,
        filename: body.filename,
        filepath: body.filepath,
        fileSize: BigInt(body.fileSize),
        duration: body.duration,
        startTime: new Date(body.startTime),
        endTime: new Date(body.endTime),
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Recording berhasil disimpan",
        data: {
          ...result,
          fileSize: result.fileSize.toString(), // Convert BigInt to string for JSON
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error saving recording:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Gagal menyimpan recording",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET /api/recordings - Dapatkan daftar recordings dengan pagination
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const sessionId = searchParams.get("sessionId");

    const skip = (page - 1) * limit;

    // Build filter
    const where: any = {};
    if (sessionId) {
      where.sessionId = sessionId;
    }

    // Get total count
    const total = await prisma.recording.count({ where });

    // Get recordings
    const recordings = await prisma.recording.findMany({
      where,
      orderBy: {
        startTime: "desc",
      },
      skip,
      take: limit,
    });

    // Convert BigInt to string for JSON serialization
    const recordingsWithStringFileSize = recordings.map((recording) => ({
      ...recording,
      fileSize: recording.fileSize.toString(),
    }));

    return NextResponse.json({
      success: true,
      data: recordingsWithStringFileSize,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching recordings:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Gagal mengambil data recordings",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE /api/recordings?id=xxx - Hapus recording
export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Recording ID wajib diisi" },
        { status: 400 }
      );
    }

    // Hapus dari database
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
