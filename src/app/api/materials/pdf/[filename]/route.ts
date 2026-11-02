// Route penyajian file PDF materi.
// File tidak disajikan dari folder publik — akses hanya melalui route ini
// dan hanya untuk pengguna yang sudah login (siswa/instruktur/admin).

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { materials } from "@/db/schema";
import { auth } from "@/auth";
import { readMaterialFile } from "@/lib/file-storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  // Wajib login
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Tidak diizinkan", { status: 401 });
  }

  const { filename } = await params;
  const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, "");

  // Pastikan file benar-benar terdaftar sebagai materi yang approved
  const [m] = await db
    .select({ status: materials.status })
    .from(materials)
    .where(eq(materials.filePath, safeName))
    .limit(1);

  if (!m) return new NextResponse("Tidak ditemukan", { status: 404 });

  // Siswa hanya bisa membuka materi approved; instruktur/admin bebas
  if (session.user.role === "siswa" && m.status !== "approved") {
    return new NextResponse("Tidak diizinkan", { status: 403 });
  }

  try {
    const buffer = await readMaterialFile(safeName);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${safeName}"`,
      },
    });
  } catch {
    return new NextResponse("File hilang", { status: 404 });
  }
}
