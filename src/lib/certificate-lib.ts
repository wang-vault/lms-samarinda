// Query & utilitas sertifikat (dipakai halaman siswa, instruktur, & API PDF)

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  certificates,
  courses,
  quizSubmissions,
  quizzes,
  users,
} from "@/db/schema";

// Sertifikat untuk ditampilkan di daftar (siswa maupun instruktur).
export type CertificateRow = {
  id: string;
  certificateNumber: string;
  userName: string;
  courseTitle: string;
  quizTitle: string;
  score: number;
  issuedAt: Date;
  // Untuk halaman siswa: apakah sertifikat ini milik user yang login.
  owned?: boolean;
};

/** Ambil semua sertifikat milik seorang siswa, urut terbaru lebih dulu. */
export async function getStudentCertificates(
  userId: string
): Promise<CertificateRow[]> {
  const rows = await db
    .select({
      id: certificates.id,
      certificateNumber: certificates.certificateNumber,
      userName: users.name,
      courseTitle: courses.title,
      quizTitle: quizzes.title,
      score: certificates.score,
      issuedAt: certificates.issuedAt,
    })
    .from(certificates)
    .innerJoin(users, eq(certificates.userId, users.id))
    .innerJoin(quizSubmissions, eq(certificates.quizSubmissionId, quizSubmissions.id))
    .innerJoin(quizzes, eq(quizSubmissions.quizId, quizzes.id))
    .innerJoin(courses, eq(quizzes.courseId, courses.id))
    .where(eq(certificates.userId, userId))
    .orderBy(desc(certificates.issuedAt));
  return rows.map((r) => ({ ...r, owned: true }));
}

/**
 * Ambil semua sertifikat dari quiz-quiz milik seorang instruktur.
 * (Query sudah memfilter courses.instructor_id, jadi semua row di hasil
 * pasti milik instruktur ini.)
 */
export async function getInstructorCertificates(
  instructorId: string
): Promise<CertificateRow[]> {
  const rows = await db
    .select({
      id: certificates.id,
      certificateNumber: certificates.certificateNumber,
      userName: users.name,
      courseTitle: courses.title,
      quizTitle: quizzes.title,
      score: certificates.score,
      issuedAt: certificates.issuedAt,
    })
    .from(certificates)
    .innerJoin(users, eq(certificates.userId, users.id))
    .innerJoin(quizSubmissions, eq(certificates.quizSubmissionId, quizSubmissions.id))
    .innerJoin(quizzes, eq(quizSubmissions.quizId, quizzes.id))
    .innerJoin(courses, eq(quizzes.courseId, courses.id))
    .where(eq(courses.instructorId, instructorId))
    .orderBy(desc(certificates.issuedAt));
  return rows;
}

/** Ambil semua sertifikat di sistem (untuk admin). */
export async function getAllCertificates(): Promise<CertificateRow[]> {
  const rows = await db
    .select({
      id: certificates.id,
      certificateNumber: certificates.certificateNumber,
      userName: users.name,
      courseTitle: courses.title,
      quizTitle: quizzes.title,
      score: certificates.score,
      issuedAt: certificates.issuedAt,
    })
    .from(certificates)
    .innerJoin(users, eq(certificates.userId, users.id))
    .innerJoin(quizSubmissions, eq(certificates.quizSubmissionId, quizSubmissions.id))
    .innerJoin(quizzes, eq(quizSubmissions.quizId, quizzes.id))
    .innerJoin(courses, eq(quizzes.courseId, courses.id))
    .orderBy(desc(certificates.issuedAt));
  return rows;
}

/**
 * Data lengkap satu sertifikat untuk pembuatan PDF.
 * Mengembalikan null bila sertifikat tidak ditemukan.
 */
export async function getCertificateData(id: string) {
  const [row] = await db
    .select({
      id: certificates.id,
      certificateNumber: certificates.certificateNumber,
      userName: users.name,
      courseTitle: courses.title,
      quizTitle: quizzes.title,
      score: certificates.score,
      issuedAt: certificates.issuedAt,
      certUserId: certificates.userId,
      courseInstructor: courses.instructorId,
    })
    .from(certificates)
    .innerJoin(users, eq(certificates.userId, users.id))
    .innerJoin(quizSubmissions, eq(certificates.quizSubmissionId, quizSubmissions.id))
    .innerJoin(quizzes, eq(quizSubmissions.quizId, quizzes.id))
    .innerJoin(courses, eq(quizzes.courseId, courses.id))
    .where(eq(certificates.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * Cek apakah seorang user boleh mengakses (melihat/mengunduh) sertifikat ini.
 * - Siswa: sertifikat miliknya sendiri.
 * - Instruktur: sertifikat dari quiz di kursus miliknya.
 * - Admin: semua sertifikat.
 */
export function canAccessCertificate(
  cert: { certUserId: string; courseInstructor: string },
  user: { id: string; role: "admin" | "instruktur" | "siswa" }
): boolean {
  if (user.role === "admin") return true;
  if (user.role === "siswa") return cert.certUserId === user.id;
  if (user.role === "instruktur") return cert.courseInstructor === user.id;
  return false;
}

/** Format tanggal terbit sertifikat dalam bahasa Indonesia, mis. "1 November 2026". */
export function formatIssueDate(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
  }).format(date);
}

// ============================================
// PEMBUATAN PDF MINIMAL (tanpa library eksternal)
// ============================================
// PDF A4 landscape satu halaman yang memakai font standar Helvetica
// (Type1 bawaan reader), jadi tidak ada file font yang perlu disertakan
// dan tidak butuh dependency tambahan.

/** Buat nomor sertifikat: SERT-YYYYMMDD-XXXXXX (6 char alfanumerik acak). */
export function makeCertificateNumber(issuedAt: Date): string {
  const y = issuedAt.getFullYear();
  const m = String(issuedAt.getMonth() + 1).padStart(2, "0");
  const d = String(issuedAt.getDate()).padStart(2, "0");
  const rand = Array.from({ length: 6 }, () =>
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 36)]
  ).join("");
  return `SERT-${y}${m}${d}-${rand}`;
}

/**
 * Bangun buffer PDF A4 landscape (842 x 595 pt) berisi sertifikat.
 * Memakai font standar Helvetica — tidak perlu menyertakan file font.
 */
export function buildCertificatePdf(data: {
  userName: string;
  courseTitle: string;
  quizTitle: string;
  score: number;
  certificateNumber: string;
  issuedAt: Date;
}): Buffer {
  const escape = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  const dateStr = formatIssueDate(data.issuedAt);
  // Baris teks sertifikat (dipusatkan di halaman).
  const lines = [
    { text: "SERTIFIKAT", size: 34, y: 470, bold: true },
    { text: "Penghargaan ini diberikan kepada:", size: 13, y: 420 },
    { text: data.userName, size: 26, y: 375, bold: true },
    { text: "telah berhasil menyelesaikan ujian", size: 13, y: 340 },
    { text: `"${data.quizTitle}"`, size: 16, y: 310 },
    { text: `pada kursus ${data.courseTitle}`, size: 13, y: 285 },
    { text: `dengan nilai akhir ${data.score} (KKM terpenuhi)`, size: 13, y: 260 },
    { text: `Diterbitkan pada ${dateStr}`, size: 11, y: 220 },
    { text: `Nomor: ${data.certificateNumber}`, size: 11, y: 200 },
  ];

  // -------- Bingkai & ornamen sederhana --------
  const deco: string[] = [
    "0.9 0.45 0.1 RG 3 w 30 30 782 535 re S", // bingkai luar (oranye)
    "0.9 0.45 0.1 RG 1 w 40 40 762 515 re S", // bingkai dalam
  ];

  // -------- Konten halaman --------
  // Perkiraan lebar teks: rata-rata 0,5 em per karakter (font Helvetica).
  // Cukup untuk memusatkan baris secara visual tanpa mengukur glyph satu per satu.
  const textWidth = (text: string, size: number) => (size * 0.5 * text.length) / 2;

  const content = [
    ...deco,
    ...lines.map((l) => {
      const font = l.bold ? "/F2" : "/F1";
      // Pusatkan baris di halaman (lebar 842 pt → titik tengah 421).
      const x = 421 - textWidth(l.text, l.size);
      return `BT ${font} ${l.size} Tf 1 0 0 1 ${x.toFixed(1)} ${l.y} Tm (${escape(l.text)}) Tj ET`;
    }),
    "BT /F1 10 Tf 1 0 0 1 60 70 Tm (Mulai Usaha dari Nol - Samarinda) Tj ET",
    "BT /F1 10 Tf 1 0 0 1 700 70 Tm (LMS) Tj ET",
    "q 0.9 0.45 0.1 RG 2 w 60 85 m 180 85 l S Q", // garis tanda tangan kiri
    "q 0.9 0.45 0.1 RG 2 w 700 85 m 790 85 l S Q", // garis tanda tangan kanan
  ].join("\n");

  // -------- Struktur file PDF --------
  const objects: string[] = [];
  // Objek 1: Katalog
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  // Objek 2: Daftar halaman
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  // Objek 3: Halaman
  objects.push(
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] " +
      "/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>"
  );
  // Objek 4: Konten (stream)
  objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  // Objek 5: Font Helvetica (reguler)
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  // Objek 6: Font Helvetica-Bold
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  // Susun byte file + tabel xref
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefPos = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.forEach((off) => {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}
