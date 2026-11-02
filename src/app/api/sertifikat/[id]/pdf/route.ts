// Route penyajian PDF sertifikat.
// PDF dibangun langsung di server (tanpa library) saat diminta, jadi tidak
// ada file yang disimpan di disk. Akses hanya untuk pemilik sertifikat,
// instruktur pemilik kursus, atau admin.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getCertificateData,
  canAccessCertificate,
  buildCertificatePdf,
} from "@/lib/certificate-lib";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Wajib login
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Tidak diizinkan", { status: 401 });
  }

  const { id } = await params;

  const cert = await getCertificateData(id);
  if (!cert) return new NextResponse("Tidak ditemukan", { status: 404 });

  if (
    !canAccessCertificate(cert, {
      id: session.user.id,
      role: session.user.role,
    })
  ) {
    return new NextResponse("Tidak diizinkan", { status: 403 });
  }

  const pdf = buildCertificatePdf({
    userName: cert.userName,
    courseTitle: cert.courseTitle,
    quizTitle: cert.quizTitle,
    score: cert.score,
    certificateNumber: cert.certificateNumber,
    issuedAt: cert.issuedAt,
  });

  const filename = `sertifikat-${cert.certificateNumber}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      // inline = tampil di tab browser; ada juga opsi unduh dari halaman.
      "content-disposition": `inline; filename="${filename}"`,
      "content-length": String(pdf.length),
    },
  });
}
