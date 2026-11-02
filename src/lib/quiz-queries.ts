// Helper penilaian & pembacaan quiz (shared antara instruktur & siswa)

import { db } from "@/db";
import { quizzes, quizQuestions, quizSubmissions } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";

// Bentuk jawaban satu soal, disimpan sebagai JSON di kolom `answers`.
export type AnswerDTO = {
  questionId: string;
  // "pilihan_ganda" | "essay"
  type: string;
  // index pilihan (untuk PG) atau teks jawaban (untuk essay)
  answer: string | number | null;
};

// Bentuk penilaian essay satu soal oleh instruktur.
export type EssayFeedbackDTO = {
  questionId: string;
  points: number;
  comment?: string;
};

// Data lengkap quiz beserta soalnya.
export type QuizWithQuestions = {
  id: string;
  courseId: string;
  title: string;
  description: string;
  durationMinutes: number;
  passingScore: number;
  questions: {
    id: string;
    type: string;
    question: string;
    options: string[] | null;
    correctOptionIndex: number | null;
    modelAnswer: string | null;
    points: number;
    orderIndex: number;
  }[];
};

/**
 * Ambil quiz + seluruh soalnya.
 * Jangan pernah mengirim correctOptionIndex/modelAnswer ke siswa.
 */
export async function getQuizWithQuestions(
  quizId: string
): Promise<QuizWithQuestions | null> {
  const [quiz] = await db
    .select({
      id: quizzes.id,
      courseId: quizzes.courseId,
      title: quizzes.title,
      description: quizzes.description,
      durationMinutes: quizzes.durationMinutes,
      passingScore: quizzes.passingScore,
    })
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1);
  if (!quiz) return null;

  const rows = await db
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
    .orderBy(asc(quizQuestions.orderIndex));

  return {
    ...quiz,
    questions: rows.map((q) => ({
      ...q,
      options: parseOptions(q.options),
    })),
  };
}

/** Parse kolom options (JSON array) menjadi array of string. */
function parseOptions(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String) : null;
  } catch {
    return null;
  }
}

/** Serialize ulang jawaban siswa dari JSON text. */
export function parseAnswers(raw: string): AnswerDTO[] {
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as AnswerDTO[]) : [];
  } catch {
    return [];
  }
}

/** Serialize ulang feedback essay dari JSON text. */
export function parseEssayFeedback(raw: string | null): EssayFeedbackDTO[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as EssayFeedbackDTO[]) : [];
  } catch {
    return [];
  }
}

/**
 * Hitung skor otomatis (pilihan ganda saja).
 * autoScore = (poin PG benar / total poin PG) * 100 — essay belum diperhitungkan.
 */
export function autoGrade(
  questions: QuizWithQuestions["questions"],
  answers: AnswerDTO[]
): { autoScore: number; pendingEssayPoints: number } {
  const pgQuestions = questions.filter((q) => q.type === "pilihan_ganda");
  const totalPg = pgQuestions.reduce((sum, q) => sum + q.points, 0);

  const answerMap = new Map(answers.map((a) => [a.questionId, a]));

  let earnedPg = 0;
  for (const q of pgQuestions) {
    const a = answerMap.get(q.id);
    if (!a) continue;
    if (typeof a.answer === "number" && a.answer === q.correctOptionIndex) {
      earnedPg += q.points;
    }
  }

  const autoScore = totalPg > 0 ? Math.round((earnedPg / totalPg) * 100) : 0;
  const pendingEssayPoints = questions
    .filter((q) => q.type === "essay")
    .reduce((sum, q) => sum + q.points, 0);

  return { autoScore, pendingEssayPoints };
}

/**
 * Hitung skor akhir setelah essay dinilai.
 * finalScore = (poin PG benar + poin essay dari instruktur) /
 *              (total poin PG + total poin essay) * 100
 */
export function finalScore(
  questions: QuizWithQuestions["questions"],
  answers: AnswerDTO[],
  earnedEssay: number
): number {
  const totalPg = questions
    .filter((q) => q.type === "pilihan_ganda")
    .reduce((s, q) => s + q.points, 0);
  const totalEssay = questions
    .filter((q) => q.type === "essay")
    .reduce((s, q) => s + q.points, 0);
  const total = totalPg + totalEssay;
  if (total <= 0) return 0;

  const answerMap = new Map(answers.map((a) => [a.questionId, a]));
  let earnedPg = 0;
  for (const q of questions) {
    if (q.type !== "pilihan_ganda") continue;
    const a = answerMap.get(q.id);
    if (!a) continue;
    if (typeof a.answer === "number" && a.answer === q.correctOptionIndex) {
      earnedPg += q.points;
    }
  }

  return Math.round(((earnedPg + (earnedEssay ?? 0)) / total) * 100);
}

/** Cek apakah quiz ini punya soal essay. */
export function hasEssayQuestions(questions: QuizWithQuestions["questions"]): boolean {
  return questions.some((q) => q.type === "essay");
}

/**
 * Ambil attempt AKTIF (draft yang belum disubmit) siswa untuk quiz tertentu.
 * Dipakai oleh halaman ujian untuk melanjutkan auto-save.
 */
export async function getActiveDraft(
  quizId: string,
  userId: string
) {
  const [draft] = await db
    .select({
      id: quizSubmissions.id,
      answers: quizSubmissions.answers,
      startedAt: quizSubmissions.startedAt,
    })
    .from(quizSubmissions)
    .where(
      and(
        eq(quizSubmissions.quizId, quizId),
        eq(quizSubmissions.userId, userId),
        eq(quizSubmissions.status, "draft")
      )
    )
    .limit(1);
  return draft ?? null;
}

/**
 * Ambil semua attempt yang sudah disubmit siswa untuk quiz tertentu,
 * urut dari yang paling lama.
 */
export async function getSubmittedAttempts(
  quizId: string,
  userId: string
) {
  return db
    .select({
      id: quizSubmissions.id,
      answers: quizSubmissions.answers,
      score: quizSubmissions.score,
      autoScore: quizSubmissions.autoScore,
      passed: quizSubmissions.passed,
      graded: quizSubmissions.graded,
      essayFeedback: quizSubmissions.essayFeedback,
      startedAt: quizSubmissions.startedAt,
      submittedAt: quizSubmissions.submittedAt,
    })
    .from(quizSubmissions)
    .where(
      and(
        eq(quizSubmissions.quizId, quizId),
        eq(quizSubmissions.userId, userId),
        eq(quizSubmissions.status, "submitted")
      )
    )
    .orderBy(asc(quizSubmissions.submittedAt));
}

/** Ambil attempt terbaik (skor tertinggi) dari riwayat yang sudah disubmit. */
export async function getBestAttempt(
  quizId: string,
  userId: string
) {
  const attempts = await getSubmittedAttempts(quizId, userId);
  if (attempts.length === 0) return null;
  return attempts.reduce((best, cur) => (cur.score > best.score ? cur : best));
}

// ============================================
// DATA SISWA (tidak boleh berisi kunci jawaban)
// ============================================

// Soal versi aman untuk siswa: tanpa correctOptionIndex & modelAnswer.
export type StudentQuestion = {
  id: string;
  type: string;
  question: string;
  options: string[] | null;
  points: number;
  orderIndex: number;
};

// Quiz versi aman untuk siswa.
export type StudentQuiz = {
  id: string;
  courseId: string;
  title: string;
  description: string;
  durationMinutes: number;
  passingScore: number;
  hasEssay: boolean;
  questions: StudentQuestion[];
};

// Satu soal dalam hasil review attempt siswa.
export type ReviewItem = {
  questionId: string;
  type: string;
  question: string;
  options: string[] | null;
  points: number;
  // Teks jawaban siswa (sudah diconvert dari index untuk PG).
  userAnswerText: string | null;
  // Index jawaban benar (hanya untuk pilihan ganda).
  correctIndex: number | null;
  isCorrect: boolean;
  // Jawaban model (hanya untuk essay, sebagai referensi setelah submit).
  modelAnswer: string | null;
  // Penilaian instruktur (hanya untuk essay yang sudah dinilai).
  feedback: EssayFeedbackDTO | null;
};

// Attempt yang sudah disubmit, lengkap dengan review per soal.
export type AttemptReview = {
  id: string;
  startedAt: Date;
  submittedAt: Date;
  score: number;
  passed: boolean;
  graded: boolean;
  items: ReviewItem[];
};

// State lengkap halaman ujian siswa.
export type StudentQuizState = {
  quiz: StudentQuiz;
  // Draft auto-save yang masih bisa dilanjutkan (jika ada).
  draft: {
    answers: Record<string, string | number | null>;
    startedAtMs: number;
  } | null;
  attempts: AttemptReview[];
};

/** Susun review per soal dari jawaban siswa & kunci quiz. */
function buildReviewItems(
  questions: QuizWithQuestions["questions"],
  answers: AnswerDTO[],
  essayFeedback: EssayFeedbackDTO[]
): ReviewItem[] {
  const answerMap = new Map(answers.map((a) => [a.questionId, a]));
  const feedbackMap = new Map(essayFeedback.map((f) => [f.questionId, f]));

  return questions.map((q) => {
    const a = answerMap.get(q.id);
    if (q.type === "pilihan_ganda") {
      const idx = typeof a?.answer === "number" ? a.answer : null;
      const isCorrect =
        idx !== null && idx !== undefined && idx === q.correctOptionIndex;
      return {
        questionId: q.id,
        type: q.type,
        question: q.question,
        options: q.options,
        points: q.points,
        userAnswerText:
          idx !== null && idx !== undefined && q.options
            ? (q.options[idx] ?? null)
            : null,
        correctIndex: q.correctOptionIndex,
        isCorrect,
        modelAnswer: null,
        feedback: null,
      };
    }
    const fb = feedbackMap.get(q.id) ?? null;
    return {
      questionId: q.id,
      type: q.type,
      question: q.question,
      options: null,
      points: q.points,
      userAnswerText: typeof a?.answer === "string" ? a.answer : null,
      correctIndex: null,
      isCorrect: fb ? fb.points >= q.points : false,
      modelAnswer: q.modelAnswer,
      feedback: fb,
    };
  });
}

/**
 * Ambil state penuh halaman ujian untuk siswa:
 * quiz versi amunisi-aman, draft aktif, dan riwayat attempt.
 */
export async function getStudentQuizData(
  quizId: string,
  userId: string
): Promise<StudentQuizState | null> {
  const quiz = await getQuizWithQuestions(quizId);
  if (!quiz) return null;

  const draft = await getActiveDraft(quizId, userId);
  const submitted = await getSubmittedAttempts(quizId, userId);

  const draftAnswers: Record<string, string | number | null> = {};
  if (draft) {
    for (const a of parseAnswers(draft.answers)) {
      draftAnswers[a.questionId] = a.answer;
    }
  }

  const attempts: AttemptReview[] = submitted.map((s) => ({
    id: s.id,
    startedAt: s.startedAt,
    submittedAt: s.submittedAt,
    score: s.score,
    passed: s.passed,
    graded: s.graded,
    items: buildReviewItems(
      quiz.questions,
      parseAnswers(s.answers),
      parseEssayFeedback(s.essayFeedback)
    ),
  }));

  return {
    quiz: {
      id: quiz.id,
      courseId: quiz.courseId,
      title: quiz.title,
      description: quiz.description,
      durationMinutes: quiz.durationMinutes,
      passingScore: quiz.passingScore,
      hasEssay: hasEssayQuestions(quiz.questions),
      questions: quiz.questions.map((q) => ({
        id: q.id,
        type: q.type,
        question: q.question,
        options: q.options,
        points: q.points,
        orderIndex: q.orderIndex,
      })),
    },
    draft: draft
      ? { answers: draftAnswers, startedAtMs: draft.startedAt.getTime() }
      : null,
    attempts,
  };
}
