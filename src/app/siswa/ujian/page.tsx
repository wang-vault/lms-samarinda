// Halaman daftar ujian untuk siswa — dikelompokkan per kursus

import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { quizzes, courses, quizSubmissions } from "@/db/schema";
import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import { BookOpen, ClipboardList } from "lucide-react";

export default async function SiswaUjianPage() {
  const user = await requireRole("siswa");

  // Ambil semua quiz + kursusnya. Sama seperti materi & video, semua
  // quiz yang ada di sistem tersedia untuk siswa (tanpa gating enroll).
  const allQuizzes = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      description: quizzes.description,
      durationMinutes: quizzes.durationMinutes,
      passingScore: quizzes.passingScore,
      courseId: quizzes.courseId,
      courseTitle: courses.title,
    })
    .from(quizzes)
    .innerJoin(courses, eq(quizzes.courseId, courses.id))
    .orderBy(asc(courses.title), asc(quizzes.createdAt));

  // Ambil semua attempt submitted siswa ini, lalu rekap per quiz
  const myAttempts = await db
    .select({
      quizId: quizSubmissions.quizId,
      score: quizSubmissions.score,
      graded: quizSubmissions.graded,
    })
    .from(quizSubmissions)
    .where(
      and(eq(quizSubmissions.userId, user.id), eq(quizSubmissions.status, "submitted"))
    );

  // bestScore = skor tertinggi yang sudah graded (atau auto-graded).
  // attemptCount = jumlah attempt submitted.
  const bestScore = new Map<string, number>();
  const attemptCount = new Map<string, number>();
  const hasPending = new Map<string, boolean>();
  for (const a of myAttempts) {
    attemptCount.set(a.quizId, (attemptCount.get(a.quizId) ?? 0) + 1);
    if (a.graded) {
      bestScore.set(a.quizId, Math.max(bestScore.get(a.quizId) ?? 0, a.score));
    } else {
      hasPending.set(a.quizId, true);
    }
  }

  // Kelompokkan per kursus
  const byCourse = new Map<string, typeof allQuizzes>();
  for (const q of allQuizzes) {
    const key = q.courseTitle ?? "Tanpa Kursus";
    if (!byCourse.has(key)) byCourse.set(key, []);
    byCourse.get(key)!.push(q);
  }

  /** Badge status untuk sebuah quiz. */
  function statusBadge(quizId: string) {
    const attempts = attemptCount.get(quizId) ?? 0;
    if (attempts === 0) {
      return (
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          Belum dikerjakan
        </span>
      );
    }
    const best = bestScore.get(quizId);
    if (best === undefined) {
      return (
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          Menunggu penilaian
        </span>
      );
    }
    return (
      <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs text-accent">
        Skor terbaik: {best}
      </span>
    );
  }

  return (
    <>
      <PageHeader
        title="Ujian"
        description="Kerjakan ujian untuk menguji pemahamanmu. Kamu bisa mengulang ujian sebanyak yang kamu mau."
      />

      {allQuizzes.length === 0 ? (
        <div className="card p-10 text-center">
          <ClipboardList className="mx-auto mb-3 h-10 w-10 text-muted/60" aria-hidden="true" />
          <h3 className="mb-1 font-semibold">Belum ada ujian</h3>
          <p className="text-sm text-muted">
            Ujian akan muncul di sini setelah instruktur membuatnya.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {[...byCourse.entries()].map(([courseTitle, items]) => (
            <section key={courseTitle}>
              <h2 className="mb-3 flex items-center gap-2 font-semibold">
                <BookOpen className="h-5 w-5 text-accent" aria-hidden="true" />
                <span>{courseTitle}</span>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((q) => {
                  const attempts = attemptCount.get(q.id) ?? 0;
                  const pending = hasPending.get(q.id) ?? false;
                  return (
                    <div key={q.id} className="card flex flex-col p-5">
                      <h3 className="mb-1 font-semibold">{q.title}</h3>
                      <p className="mb-3 line-clamp-2 flex-1 text-xs text-muted">
                        {q.description || "Tanpa deskripsi"}
                      </p>
                      <div className="mb-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          {q.durationMinutes} menit
                        </span>
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          KKM {q.passingScore}
                        </span>
                        {attempts > 0 && (
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            {attempts}x percobaan
                          </span>
                        )}
                      </div>
                      <div className="mb-3">{statusBadge(q.id)}</div>
                      {pending && (
                        <p className="mb-3 text-xs text-muted">
                          Ada attempt yang sedang menunggu penilaian instruktur.
                        </p>
                      )}
                      <Link
                        href={`/siswa/ujian/${q.id}`}
                        className="btn-primary text-center text-sm"
                      >
                        {attempts > 0 ? "Buka Ujian" : "Kerjakan Ujian"}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
