"use server";

// Penerbitan sertifikat otomatis saat siswa lulus ujian.
// Dipanggil dari submitQuizAction (quiz tanpa essay) dan gradeEssaysAction
// (quiz dengan essay setelah dinilai instruktur).

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { certificates, courses, notifications, quizSubmissions, quizzes } from "@/db/schema";
import { makeCertificateNumber } from "@/lib/certificate-lib";

/**
 * Terbitkan sertifikat untuk sebuah submission bila siswanya LULUS.
 * - Hanya submission "submitted" yang sudah graded && passed yang dapat sertifikat.
 * - Satu submission maksimal satu sertifikat (dicegah oleh unique index
 *   quiz_submission_id + pre-check di sini).
 * - Mengembalikan sertifikat yang baru diterbitkan, atau null bila tidak
 *   perlu / sudah ada (idempoten — aman dipanggil berulang).
 */
export async function issueCertificateForSubmission(
  submissionId: string
): Promise<{ id: string; certificateNumber: string } | null> {
  if (!submissionId) return null;

  // Ambil data submission + quiz + kursus sekaligus.
  const [sub] = await db
    .select({
      id: quizSubmissions.id,
      userId: quizSubmissions.userId,
      courseId: quizzes.courseId,
      score: quizSubmissions.score,
      graded: quizSubmissions.graded,
      passed: quizSubmissions.passed,
      status: quizSubmissions.status,
      quizTitle: quizzes.title,
      courseTitle: courses.title,
    })
    .from(quizSubmissions)
    .innerJoin(quizzes, eq(quizSubmissions.quizId, quizzes.id))
    .innerJoin(courses, eq(quizzes.courseId, courses.id))
    .where(eq(quizSubmissions.id, submissionId))
    .limit(1);

  // Submission tidak ditemukan / belum dinilai / tidak lulus → tidak terbit.
  if (!sub) return null;
  if (sub.status !== "submitted") return null;
  if (!sub.graded || !sub.passed) return null;
  if (sub.score === null) return null;

  // Pre-check idempotensi: bila sertifikat untuk submission ini sudah ada,
  // jangan buat duplikat. (Unique index quiz_submission_id sebagai pengaman
  // bila dua request lolos bersamaan.)
  const [existing] = await db
    .select({
      id: certificates.id,
      certificateNumber: certificates.certificateNumber,
    })
    .from(certificates)
    .where(eq(certificates.quizSubmissionId, submissionId))
    .limit(1);
  if (existing) return existing;

  const issuedAt = new Date();
  const certificateNumber = makeCertificateNumber(issuedAt);

  const [inserted] = await db
    .insert(certificates)
    .values({
      userId: sub.userId,
      courseId: sub.courseId,
      quizSubmissionId: submissionId,
      certificateNumber,
      score: sub.score,
      issuedAt,
    })
    .returning({ id: certificates.id });

  // Notifikasi untuk siswa.
  await db.insert(notifications).values({
    userId: sub.userId,
    title: "Sertifikat diterbitkan",
    message: `Selamat! Kamu lulus ujian "${sub.quizTitle}" pada kursus "${sub.courseTitle}" dengan nilai ${sub.score}. Sertifikat sudah tersedia di halaman Sertifikat.`,
    type: "success",
  });

  return { id: inserted.id, certificateNumber };
}
