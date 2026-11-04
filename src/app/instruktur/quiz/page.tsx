// Halaman kelola quiz & ujian milik instruktur
import Link from "next/link";
import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { courses, quizzes, quizQuestions, quizSubmissions } from "@/db/schema";
import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import { QuizFormDialog } from "@/components/instruktur/quiz-form-dialog";
import { DeleteQuizButton } from "@/components/instruktur/delete-quiz-button";
import { ClipboardList, BookOpen } from "lucide-react";

export default async function InstrukturQuizPage() {
  const user = await requireRole("instruktur");

  const [myCourses, myQuizzes] = await Promise.all([
    db
      .select({ id: courses.id, title: courses.title })
      .from(courses)
      .where(eq(courses.instructorId, user.id))
      .orderBy(desc(courses.createdAt)),
    db
      .select({
        id: quizzes.id,
        title: quizzes.title,
        description: quizzes.description,
        durationMinutes: quizzes.durationMinutes,
        passingScore: quizzes.passingScore,
        createdAt: quizzes.createdAt,
        courseId: quizzes.courseId,
        courseTitle: courses.title,
      })
      .from(quizzes)
      .innerJoin(courses, eq(quizzes.courseId, courses.id))
      .where(eq(courses.instructorId, user.id))
      .orderBy(desc(quizzes.createdAt)),
  ]);

  // Hitung soal & submission per quiz dalam satu query grouped
  const stats = await Promise.all([
    db
      .select({
        quizId: quizQuestions.quizId,
        total: count(),
      })
      .from(quizQuestions)
      .groupBy(quizQuestions.quizId),
    db
      .select({
        quizId: quizSubmissions.quizId,
        ungraded: count(),
      })
      .from(quizSubmissions)
      .where(
        and(eq(quizSubmissions.status, "submitted"), eq(quizSubmissions.graded, false))
      )
      .groupBy(quizSubmissions.quizId),
  ]);
  const questionCounts = new Map(stats[0].map((r) => [r.quizId, r.total]));
  const ungradedCounts = new Map(stats[1].map((r) => [r.quizId, r.ungraded]));

  const quizzesByCourse = new Map<string, typeof myQuizzes>();
  for (const q of myQuizzes) {
    const key = q.courseTitle ?? "Tanpa Kursus";
    if (!quizzesByCourse.has(key)) quizzesByCourse.set(key, []);
    quizzesByCourse.get(key)!.push(q);
  }

  return (
    <>
      <PageHeader
        title="Quiz & Ujian"
        description="Buat ujian untuk kursusmu, lengkap dengan soal pilihan ganda dan essay."
        action={
          myCourses.length > 0 ? (
            <QuizFormDialog mode="create" courses={myCourses} />
          ) : undefined
        }
      />

      {myQuizzes.length === 0 ? (
        <div className="card p-10 text-center">
          <ClipboardList className="mx-auto mb-3 h-10 w-10 text-muted/60" aria-hidden="true" />
          <h3 className="mb-1 font-semibold">Belum ada quiz</h3>
          <p className="mb-4 text-sm text-muted">
            {myCourses.length === 0
              ? "Buat kursus pertamamu sebelum membuat quiz."
              : "Buat quiz pertamamu untuk mulai menguji pemahaman siswa."}
          </p>
          {myCourses.length > 0 && (
            <QuizFormDialog mode="create" courses={myCourses} />
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {[...quizzesByCourse.entries()].map(([courseTitle, items]) => (
            <section key={courseTitle}>
              <h2 className="mb-3 flex items-center gap-2 font-semibold">
                <BookOpen className="h-5 w-5 text-accent" aria-hidden="true" />
                <span>{courseTitle}</span>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((q) => {
                  const qCount = questionCounts.get(q.id) ?? 0;
                  const ungraded = ungradedCounts.get(q.id) ?? 0;
                  return (
                    <div key={q.id} className="card flex flex-col p-5">
                      <h3 className="mb-1 font-semibold">{q.title}</h3>
                      <p className="mb-3 line-clamp-2 flex-1 text-xs text-muted">
                        {q.description || "Tanpa deskripsi"}
                      </p>
                      <div className="mb-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-accent">
                          {qCount} soal
                        </span>
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          {q.durationMinutes} menit
                        </span>
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          KKM {q.passingScore}
                        </span>
                        {ungraded > 0 && (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                            {ungraded} perlu dinilai
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Link
                          href={`/instruktur/quiz/${q.id}`}
                          className="btn-primary flex-1 text-center text-sm"
                        >
                          Kelola Quiz
                        </Link>
                        <QuizFormDialog
                          mode="edit"
                          courses={myCourses}
                          quiz={q}
                        />
                        <DeleteQuizButton id={q.id} title={q.title} />
                      </div>
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
