// Halaman detail quiz: kelola soal & nilai essay siswa
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { quizzes, quizQuestions, quizSubmissions, courses, users } from "@/db/schema";
import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import { QuestionFormDialog } from "@/components/instruktur/question-form-dialog";
import { DeleteQuestionButton } from "@/components/instruktur/delete-question-button";
import { QuizFormDialog } from "@/components/instruktur/quiz-form-dialog";
import { DeleteQuizButton } from "@/components/instruktur/delete-quiz-button";
import { EssayGradingDialog } from "@/components/instruktur/essay-grading-dialog";

// Soal yang diteruskan ke dialog grading essay
type GradingQuestion = {
  id: string;
  type: string;
  question: string;
  options: string[] | null;
  modelAnswer: string | null;
  points: number;
};

export default async function InstrukturQuizDetailPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const user = await requireRole("instruktur");
  const { quizId } = await params;

  // Ambil quiz & pastikan milik instruktur yang login
  const [quiz] = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      description: quizzes.description,
      durationMinutes: quizzes.durationMinutes,
      passingScore: quizzes.passingScore,
      courseTitle: courses.title,
      courseInstructor: courses.instructorId,
    })
    .from(quizzes)
    .innerJoin(courses, eq(quizzes.courseId, courses.id))
    .where(eq(quizzes.id, quizId))
    .limit(1);
  if (!quiz || quiz.courseInstructor !== user.id) {
    return (
      <>
        <PageHeader title="Quiz tidak ditemukan" />
        <div className="card p-10 text-center">
          <p className="text-sm text-muted">
            Quiz ini tidak ada atau bukan milikmu.{" "}
            <Link href="/instruktur/quiz" className="text-accent hover:underline">
              Kembali ke daftar quiz
            </Link>
          </p>
        </div>
      </>
    );
  }

  const [questions, submissions] = await Promise.all([
    db
      .select({
        id: quizQuestions.id,
        type: quizQuestions.type,
        question: quizQuestions.question,
        options: quizQuestions.options,
        correctOptionIndex: quizQuestions.correctOptionIndex,
        modelAnswer: quizQuestions.modelAnswer,
        points: quizQuestions.points,
        orderIndex: quizQuestions.orderIndex,
      })
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId))
      .orderBy(asc(quizQuestions.orderIndex)),
    db
      .select({
        id: quizSubmissions.id,
        userId: quizSubmissions.userId,
        userName: users.name,
        answers: quizSubmissions.answers,
        score: quizSubmissions.score,
        autoScore: quizSubmissions.autoScore,
        passed: quizSubmissions.passed,
        graded: quizSubmissions.graded,
        submittedAt: quizSubmissions.submittedAt,
      })
      .from(quizSubmissions)
      .innerJoin(users, eq(quizSubmissions.userId, users.id))
      .where(
        and(
          eq(quizSubmissions.quizId, quizId),
          eq(quizSubmissions.status, "submitted")
        )
      )
      .orderBy(asc(quizSubmissions.submittedAt)),
  ]);

  const totalPoints = questions.reduce((s, q) => s + q.points, 0);
  const hasEssay = questions.some((q) => q.type === "essay");
  const gradingQuestions: GradingQuestion[] = questions.map((q) => ({
    id: q.id,
    type: q.type,
    question: q.question,
    options: q.options ? JSON.parse(q.options) : null,
    modelAnswer: q.modelAnswer,
    points: q.points,
  }));

  return (
    <>
      <PageHeader
        title={quiz.title}
        description={`${quiz.courseTitle} • ${quiz.durationMinutes} menit • KKM ${quiz.passingScore}`}
        action={
          <div className="flex gap-2">
            <QuizFormDialog mode="edit" courses={[]} quiz={quiz} />
            <DeleteQuizButton id={quiz.id} title={quiz.title} />
          </div>
        }
      />

      {quiz.description && (
        <p className="mb-6 text-sm text-muted">{quiz.description}</p>
      )}

      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <span>📃</span> Daftar Soal ({questions.length})
          </h2>
          <QuestionFormDialog quizId={quizId} />
        </div>

        {questions.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="mb-3 text-4xl">📃</div>
            <h3 className="mb-1 font-semibold">Belum ada soal</h3>
            <p className="mb-4 text-sm text-muted">
              Tambahkan soal pilihan ganda atau essay ke quiz ini.
            </p>
            <QuestionFormDialog quizId={quizId} />
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q, i) => (
              <div key={q.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        Soal {i + 1}
                      </span>
                      <span className="rounded-full bg-accent-soft px-2.5 py-1 text-accent">
                        {q.type === "pilihan_ganda" ? "Pilihan Ganda" : "Essay"}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {q.points} poin
                      </span>
                    </div>
                    <p className="mb-3 font-medium whitespace-pre-wrap">{q.question}</p>
                    {q.type === "pilihan_ganda" &&
                      q.options && (
                        <ul className="space-y-1 text-sm">
                          {JSON.parse(q.options).map((opt: string, j: number) => (
                            <li
                              key={j}
                              className={
                                j === q.correctOptionIndex
                                  ? "flex items-center gap-2 font-medium text-green-700 dark:text-green-400"
                                  : "flex items-center gap-2 text-muted"
                              }
                            >
                              <span>{String.fromCharCode(65 + j)}.</span>
                              <span>{opt}</span>
                              {j === q.correctOptionIndex && <span>✓</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                    {q.type === "essay" && q.modelAnswer && (
                      <div className="mt-2 rounded-lg bg-gray-50 p-3 text-sm text-muted dark:bg-gray-900">
                        <p className="mb-1 font-medium text-foreground">
                          Jawaban model:
                        </p>
                        <p className="whitespace-pre-wrap">{q.modelAnswer}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <QuestionFormDialog
                      quizId={quizId}
                      question={{
                        ...q,
                        options: q.options ? JSON.parse(q.options) : null,
                      }}
                    />
                    <DeleteQuestionButton id={q.id} question={q.question} />
                  </div>
                </div>
              </div>
            ))}
            <p className="text-xs text-muted">Total poin: {totalPoints}</p>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <span>📊</span> Hasil Siswa ({submissions.length})
        </h2>

        {submissions.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="mb-3 text-4xl">📊</div>
            <h3 className="mb-1 font-semibold">Belum ada yang mengerjakan</h3>
            <p className="text-sm text-muted">
              Hasil ujian siswa akan muncul di sini setelah mereka submit.
            </p>
          </div>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-gray-50 text-xs text-muted dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 font-medium">Siswa</th>
                  <th className="px-4 py-3 font-medium">Skor PG</th>
                  <th className="px-4 py-3 font-medium">Nilai</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Waktu Submit</th>
                  <th className="px-4 py-3 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">{s.userName}</td>
                    <td className="px-4 py-3">{s.autoScore}</td>
                    <td className="px-4 py-3 font-semibold">{s.score}</td>
                    <td className="px-4 py-3">
                      {s.graded ? (
                        <span
                          className={
                            s.passed
                              ? "rounded-full bg-green-100 px-2.5 py-1 text-xs text-green-700 dark:bg-green-950 dark:text-green-300"
                              : "rounded-full bg-red-100 px-2.5 py-1 text-xs text-red-700 dark:bg-red-950 dark:text-red-300"
                          }
                        >
                          {s.passed ? "Lulus" : "Tidak Lulus"}
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          Menunggu penilaian
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {new Date(s.submittedAt).toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {hasEssay ? (
                        <EssayGradingDialog
                          submissionId={s.id}
                          studentName={s.userName}
                          answers={s.answers}
                          questions={gradingQuestions}
                        />
                      ) : (
                        <span className="text-xs text-muted">Auto-graded</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
