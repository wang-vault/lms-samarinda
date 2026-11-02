// Halaman pengerjaan & riwayat ujian untuk siswa

import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { quizzes, courses } from "@/db/schema";
import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import { getStudentQuizData } from "@/lib/quiz-queries";
import { QuizRunner } from "@/components/siswa/quiz-runner";

export default async function SiswaUjianDetailPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const user = await requireRole("siswa");
  const { quizId } = await params;

  // Pastikan quiz valid & terbit di sebuah kursus (tidak orphan)
  const [quiz] = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      courseTitle: courses.title,
    })
    .from(quizzes)
    .innerJoin(courses, eq(quizzes.courseId, courses.id))
    .where(eq(quizzes.id, quizId))
    .limit(1);
  if (!quiz) {
    return (
      <>
        <PageHeader title="Ujian tidak ditemukan" />
        <div className="card p-10 text-center">
          <p className="text-sm text-muted">
            Ujian ini tidak ada.{" "}
            <Link href="/siswa/ujian" className="text-accent hover:underline">
              Kembali ke daftar ujian
            </Link>
          </p>
        </div>
      </>
    );
  }

  // Data lengkap versi siswa (tanpa kunci jawaban) + draft + riwayat
  const data = await getStudentQuizData(quizId, user.id);

  return (
    <>
      <PageHeader
        title={quiz.title}
        description={`${quiz.courseTitle} • ${data?.quiz.durationMinutes ?? 0} menit • KKM ${data?.quiz.passingScore ?? 0}`}
      />

      <div className="mb-4">
        <Link
          href="/siswa/ujian"
          className="text-sm text-accent hover:underline"
        >
          ← Kembali ke daftar ujian
        </Link>
      </div>

      {data && data.quiz.questions.length > 0 ? (
        <QuizRunner
          quiz={data.quiz}
          draft={data.draft}
          attempts={data.attempts}
        />
      ) : (
        <div className="card p-10 text-center">
          <div className="mb-3 text-4xl">📃</div>
          <h3 className="mb-1 font-semibold">Quiz belum memiliki soal</h3>
          <p className="text-sm text-muted">
            Ujian ini belum bisa dikerjakan. Silakan kembali nanti.
          </p>
        </div>
      )}
    </>
  );
}
