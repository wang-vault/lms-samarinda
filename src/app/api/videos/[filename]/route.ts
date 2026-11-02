// Route penyajian file video dengan HTTP Range streaming.
// Akses hanya untuk pengguna yang sudah login (siswa/instruktur/admin).

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { videos } from "@/db/schema";
import { auth } from "@/auth";
import { readVideoRange, videoFileSize } from "@/lib/file-storage";

const VIDEO_MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  // Wajib login
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Tidak diizinkan", { status: 401 });
  }

  const { filename } = await params;
  // Sanitasi nama file — cegah path traversal
  if (!/^[\w.-]+$/.test(filename)) {
    return new NextResponse("Nama file tidak valid", { status: 400 });
  }

  // Pastikan file terdaftar sebagai video yang valid
  const [video] = await db
    .select({ filePath: videos.filePath })
    .from(videos)
    .where(eq(videos.filePath, filename))
    .limit(1);

  if (!video) return new NextResponse("Tidak ditemukan", { status: 404 });

  const total = await videoFileSize(filename);
  if (total === 0) return new NextResponse("File hilang", { status: 404 });

  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  const contentType = VIDEO_MIME[ext] ?? "application/octet-stream";

  // Dukung HTTP Range request untuk streaming (browser memutuskan sendiri)
  const range = request.headers.get("range");
  if (range) {
    // Format: "bytes=START-END" (END opsional)
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match) {
      return new NextResponse("Range tidak valid", { status: 416 });
    }
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : total - 1;

    if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= total) {
      return new NextResponse("Range tidak valid", { status: 416, headers: { "content-range": `bytes */${total}` } });
    }

    const { chunk } = await readVideoRange(filename, start, end);
    return new NextResponse(new Uint8Array(chunk), {
      status: 206,
      headers: {
        "content-type": contentType,
        "content-length": String(chunk.length),
        "content-range": `bytes ${start}-${end}/${total}`,
        "accept-ranges": "bytes",
        "cache-control": "private, no-store",
      },
    });
  }

  // Tanpa Range: kirim seluruh file
  const { chunk } = await readVideoRange(filename, 0, total - 1);
  return new NextResponse(new Uint8Array(chunk), {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-length": String(total),
      "accept-ranges": "bytes",
      "cache-control": "private, no-store",
    },
  });
}
