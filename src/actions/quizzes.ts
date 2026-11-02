"use server";

// Server actions manajemen quiz & pengerjaan ujian

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  quizzes,
  quizQuestions,
  quizSubmissions,
  courses,
  users,
} from "@/db/schema";
import { requireRole } from "@/lib/auth-helpers";
import { issueCertificateForSubmission } from "@/actions/certificates";
import {
  getQuizWithQuestions,
  getActiveDraft,
  parseAnswers,
  autoGrade,
  finalScore,
  hasEssayQuestions,
  type AnswerDTO,
  type EssayFeedbackDTO,
  type QuizWithQuestions,
} from "@/lib/quiz-queries";

export type ActionState = {
  error?: string;
  success?: string;
};

// ============================================
// QUIZ (Instruktur)
// ============================================

/** Instruktur membuat quiz baru. */
export async function createQuizAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireRole("instruktur");

  const courseId = String(formData.get("courseId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const durationRaw = String(formData.get("durationMinutes") ?? "").trim();
  const passingRaw = String(formData.get("passingScore") ?? "").trim();

  if (!courseId) return { error: "Kursus wajib dipilih." };
  if (!title) return { error: "Judul quiz wajib diisi." };
  if (title.length > 200) return { error: "Judul maksimal 200 karakter." };

  // Pastikan kursus ini milik instruktur yang login
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.instructorId, user.id)))
    .limit(1);
  if (!course) return { error: "Kursus tidak ditemukan." };

  const durationMinutes = Number(durationRaw);
  const passingScore = Number(passingRaw);

  await db.insert(quizzes).values({
    courseId,
    title,
    description,
    durationMinutes:
      Number.isFinite(durationMinutes) && durationMinutes > 0
        ? durationMinutes
        : 30,
    passingScore:
      Number.isFinite(passingScore) && passingScore >= 0 && passingScore <= 100
        ? passingScore
        : 70,
    createdBy: user.id,
  });

  revalidatePath("/instruktur/quiz");
  return { success: "Quiz berhasil dibuat." };
}

/** Update setting quiz (hanya pemilik kursus). */
export async function updateQuizAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireRole("instruktur");

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const durationRaw = String(formData.get("durationMinutes") ?? "").trim();
  const passingRaw = String(formData.get("passingScore") ?? "").trim();

  if (!id || !title) return { error: "Data tidak lengkap." };

  const [quiz] = await db
    .select({ id: quizzes.id, courseInstructor: courses.instructorId })
    .from(quizzes)
    .leftJoin(courses, eq(quizzes.courseId, courses.id))
    .where(eq(quizzes.id, id))
    .limit(1);
  if (!quiz || quiz.courseInstructor !== user.id) {
    return { error: "Quiz tidak ditemukan." };
  }

  const durationMinutes = Number(durationRaw);
  const passingScore = Number(passingRaw);

  await db
    .update(quizzes)
    .set({
      title,
      description,
      durationMinutes:
        Number.isFinite(durationMinutes) && durationMinutes > 0
          ? durationMinutes
          : 30,
      passingScore:
        Number.isFinite(passingScore) && passingScore >= 0 && passingScore <= 100
          ? passingScore
          : 70,
    })
    .where(eq(quizzes.id, id));

  revalidatePath("/instruktur/quiz");
  return { success: "Quiz berhasil diperbarui." };
}

/** Hapus quiz beserta soal & hasil ujiannya (hanya pemilik kursus). */
export async function deleteQuizAction(id: string): Promise<void> {
  const user = await requireRole("instruktur");

  const [quiz] = await db
    .select({ id: quizzes.id, courseInstructor: courses.instructorId })
    .from(quizzes)
    .leftJoin(courses, eq(quizzes.courseId, courses.id))
    .where(eq(quizzes.id, id))
    .limit(1);
  if (!quiz || quiz.courseInstructor !== user.id) return;

  await db.delete(quizzes).where(eq(quizzes.id, id));

  revalidatePath("/instruktur/quiz");
}

/** Tambah soal ke quiz (hanya pemilik kursus). */
export async function addQuestionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireRole("instruktur");

  const quizId = String(formData.get("quizId") ?? "");
  const type = String(formData.get("type") ?? "pilihan_ganda");
  const question = String(formData.get("question") ?? "").trim();
  const pointsRaw = String(formData.get("points") ?? "").trim();
  const orderRaw = String(formData.get("orderIndex") ?? "").trim();

  if (!quizId || !question) return { error: "Soal wajib diisi." };

  const [quiz] = await db
    .select({ id: quizzes.id, courseInstructor: courses.instructorId })
    .from(quizzes)
    .leftJoin(courses, eq(quizzes.courseId, courses.id))
    .where(eq(quizzes.id, quizId))
    .limit(1);
  if (!quiz || quiz.courseInstructor !== user.id) {
    return { error: "Quiz tidak ditemukan." };
  }

  const points = Number(pointsRaw);
  const pointsValue =
    Number.isFinite(points) && points > 0 ? Math.round(points) : 1;

  let options: string[] | null = null;
  let correctOptionIndex: number | null = null;
  let modelAnswer: string | null = null;

  if (type === "pilihan_ganda") {
    // Pilihan dikirim sebagai input terpisah: option_0, option_1, ...
    const optList: string[] = [];
    for (let i = 0; i < 10; i++) {
      const opt = String(formData.get(`option_${i}`) ?? "").trim();
      if (opt) optList.push(opt);
    }
    if (optList.length < 2) {
      return { error: "Pilihan ganda minimal harus ada 2 pilihan." };
    }
    const correctRaw = String(formData.get("correctOptionIndex") ?? "");
    const correctIdx = Number(correctRaw);
    if (
      !Number.isFinite(correctIdx) ||
      correctIdx < 0 ||
      correctIdx >= optList.length
    ) {
      return { error: "Jawaban benar harus dipilih." };
    }
    options = optList;
    correctOptionIndex = correctIdx;
  } else if (type === "essay") {
    modelAnswer = String(formData.get("modelAnswer") ?? "").trim() || null;
  } else {
    return { error: "Tipe soal tidak valid." };
  }

  // orderIndex: ambil dari form, atau letakkan di akhir urutan quiz.
  // CATATAN: form kosong -> Number("") = 0 yang finite, jadi cek string-nya
  // dulu agar fallback penghitungan urutan tetap dijalankan.
  const orderFromForm = orderRaw !== "" ? Number(orderRaw) : NaN;
  let orderIndex = orderFromForm;
  if (!Number.isFinite(orderIndex) || orderIndex < 0) {
    const last = await db
      .select({ orderIndex: quizQuestions.orderIndex })
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId))
      .orderBy(desc(quizQuestions.orderIndex))
      .limit(1);
    orderIndex = (last[0]?.orderIndex ?? -1) + 1;
  }

  await db.insert(quizQuestions).values({
    quizId,
    type: type as "pilihan_ganda" | "essay",
    question,
    options: options ? JSON.stringify(options) : null,
    correctOptionIndex,
    modelAnswer,
    points: pointsValue,
    orderIndex,
  });

  revalidatePath("/instruktur/quiz");
  return { success: "Soal berhasil ditambahkan." };
}

/** Hapus soal dari quiz (hanya pemilik kursus). */
export async function deleteQuestionAction(questionId: string): Promise<void> {
  const user = await requireRole("instruktur");

  const [q] = await db
    .select({
      id: quizQuestions.id,
      courseInstructor: courses.instructorId,
    })
    .from(quizQuestions)
    .innerJoin(quizzes, eq(quizQuestions.quizId, quizzes.id))
    .leftJoin(courses, eq(quizzes.courseId, courses.id))
    .where(eq(quizQuestions.id, questionId))
    .limit(1);
  if (!q || q.courseInstructor !== user.id) return;

  await db.delete(quizQuestions).where(eq(quizQuestions.id, questionId));

  revalidatePath("/instruktur/quiz");
}

/** Update soal (hanya pemilik kursus). */
export async function updateQuestionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireRole("instruktur");

  const id = String(formData.get("id") ?? "");
  const question = String(formData.get("question") ?? "").trim();
  const pointsRaw = String(formData.get("points") ?? "").trim();

  if (!id || !question) return { error: "Data tidak lengkap." };

  const [row] = await db
    .select({
      id: quizQuestions.id,
      type: quizQuestions.type,
      quizId: quizQuestions.quizId,
      courseInstructor: courses.instructorId,
    })
    .from(quizQuestions)
    .innerJoin(quizzes, eq(quizQuestions.quizId, quizzes.id))
    .leftJoin(courses, eq(quizzes.courseId, courses.id))
    .where(eq(quizQuestions.id, id))
    .limit(1);
  if (!row || row.courseInstructor !== user.id) {
    return { error: "Soal tidak ditemukan." };
  }

  const points = Number(pointsRaw);
  const pointsValue = Number.isFinite(points) && points > 0 ? Math.round(points) : 1;

  // Ambil data lama untuk pertahankan options/correct/model bila
  // input form tidak menyertakan field tersebut.
  const [old] = await db
    .select({
      options: quizQuestions.options,
      correctOptionIndex: quizQuestions.correctOptionIndex,
      modelAnswer: quizQuestions.modelAnswer,
    })
    .from(quizQuestions)
    .where(eq(quizQuestions.id, id))
    .limit(1);

  let options = old?.options ?? null;
  let correctOptionIndex = old?.correctOptionIndex ?? null;
  const modelAnswer = old?.modelAnswer ?? null;

  // Jika tipe soal pilihan ganda dan form mengirim options baru, perbarui.
  if (row.type === "pilihan_ganda") {
    const optList: string[] = [];
    for (let i = 0; i < 10; i++) {
      const opt = String(formData.get(`option_${i}`) ?? "").trim();
      if (opt) optList.push(opt);
    }
    if (optList.length >= 2) {
      const correctIdx = Number(formData.get("correctOptionIndex") ?? "");
      if (Number.isFinite(correctIdx) && correctIdx >= 0 && correctIdx < optList.length) {
        options = JSON.stringify(optList);
        correctOptionIndex = correctIdx;
      }
    }
  }

  await db
    .update(quizQuestions)
    .set({
      question,
      points: pointsValue > 0 ? pointsValue : 1,
      options,
      correctOptionIndex,
      modelAnswer,
    })
    .where(eq(quizQuestions.id, id));

  revalidatePath("/instruktur/quiz");
  return { success: "Soal berhasil diperbarui." };
}

// ============================================
// PENGERJAAN UJIAN (Siswa)
// jawaban: Record<questionId, answer>
// ============================================

/**
 * Simpan progress jawaban siswa (auto-save).
 * Draft disimpan terpisah dari attempt yang sudah disubmit.
 */
export async function saveQuizAnswersAction(
  quizId: string,
  answers: Record<string, string | number | null>
): Promise<{ error?: string; submissionId?: string }> {
  const user = await requireRole("siswa");
  if (!quizId) return { error: "Quiz tidak valid." };

  const quiz = await getQuizWithQuestions(quizId);
  if (!quiz) return { error: "Quiz tidak ditemukan." };

  const answerDTOs = normalizeAnswers(quiz.questions, answers);

  // Ambil draft yang masih aktif (jika ada) untuk dilanjutkan.
  const draft = await getActiveDraft(quizId, user.id);

  if (draft) {
    await db
      .update(quizSubmissions)
      .set({ answers: JSON.stringify(answerDTOs) })
      .where(eq(quizSubmissions.id, draft.id));
    return { submissionId: draft.id };
  }

  const [inserted] = await db
    .insert(quizSubmissions)
    .values({
      quizId,
      userId: user.id,
      answers: JSON.stringify(answerDTOs),
      status: "draft",
    })
    .returning({ id: quizSubmissions.id });
  return { submissionId: inserted.id };
}

/**
 * Submith jawaban ujian: kunci draft menjadi attempt, lalu auto-grade PG.
 * `deadlineMs` = batas waktu ujian (startedAt + duration). Submit setelah
 * deadline ditolak meskipun client mengirimnya (anti-cheat sisi server).
 */
export async function submitQuizAction(
  quizId: string,
  answers: Record<string, string | number | null>,
  startedAtMs: number
): Promise<{ error?: string; submissionId?: string; score?: number; passed?: boolean }> {
  const user = await requireRole("siswa");
  if (!quizId) return { error: "Quiz tidak valid." };

  const quiz = await getQuizWithQuestions(quizId);
  if (!quiz) return { error: "Quiz tidak ditemukan." };

  // Anti-cheat: tolak submit setelah waktu ujian habis.
  const deadline = startedAtMs + quiz.durationMinutes * 60_000;
  // Toleransi kecil (5 detik) untuk latensi jaringan.
  if (Date.now() > deadline + 5_000) {
    return { error: "Waktu ujian sudah habis." };
  }

  const answerDTOs = normalizeAnswers(quiz.questions, answers);
  const { autoScore } = autoGrade(quiz.questions, answerDTOs);

  // Quiz tanpa essay langsung nilai akhir = autoScore dan graded = true.
  const gradedNow = !hasEssayQuestions(quiz.questions);
  const passed = gradedNow ? autoScore >= quiz.passingScore : false;

  const draft = await getActiveDraft(quizId, user.id);

  const values = {
    quizId,
    userId: user.id,
    answers: JSON.stringify(answerDTOs),
    status: "submitted" as const,
    score: autoScore,
    autoScore,
    passed,
    graded: gradedNow,
    startedAt: new Date(startedAtMs),
    submittedAt: new Date(),
  };

  let submissionId: string;
  if (draft) {
    await db
      .update(quizSubmissions)
      .set(values)
      .where(eq(quizSubmissions.id, draft.id));
    submissionId = draft.id;
  } else {
    const [inserted] = await db
      .insert(quizSubmissions)
      .values(values)
      .returning({ id: quizSubmissions.id });
    submissionId = inserted.id;
  }

  // Terbitkan sertifikat otomatis bila siswa lulus (hanya quiz tanpa essay
  // yang langsung graded di sini; quiz essay ditangani saat penilaian).
  if (gradedNow && passed) {
    await issueCertificateForSubmission(submissionId);
  }

  return { submissionId, score: autoScore, passed };
}

/** Normalisasi jawaban mentah dari client ke bentuk AnswerDTO[]. */
function normalizeAnswers(
  questions: QuizWithQuestions["questions"],
  answers: Record<string, string | number | null>
): AnswerDTO[] {
  return questions.map((q) => {
    const raw = answers[q.id];
    if (q.type === "pilihan_ganda") {
      const idx = typeof raw === "number" ? raw : Number(raw);
      return {
        questionId: q.id,
        type: q.type,
        answer: Number.isFinite(idx) ? idx : null,
      };
    }
    return {
      questionId: q.id,
      type: q.type,
      answer: typeof raw === "string" ? raw : raw != null ? String(raw) : null,
    };
  });
}

// ============================================
// PENILAIAN ESSAY (Instruktur)
// ============================================

/**
 * Instruktur menilai essay seorang siswa.
 * Form mengirim: submissionId, questionId_<i>, points_<i>, comment_<i>
 * untuk setiap soal essay. Nilai akhir dihitung dari PG + essay.
 */
export async function gradeEssaysAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireRole("instruktur");

  const submissionId = String(formData.get("submissionId") ?? "");
  if (!submissionId) return { error: "Hasil ujian tidak valid." };

  const [sub] = await db
    .select({
      id: quizSubmissions.id,
      quizId: quizSubmissions.quizId,
      answers: quizSubmissions.answers,
      courseInstructor: courses.instructorId,
    })
    .from(quizSubmissions)
    .innerJoin(quizzes, eq(quizSubmissions.quizId, quizzes.id))
    .leftJoin(courses, eq(quizzes.courseId, courses.id))
    .where(eq(quizSubmissions.id, submissionId))
    .limit(1);
  if (!sub) return { error: "Hasil ujian tidak ditemukan." };
  if (sub.courseInstructor !== user.id) return { error: "Bukan quiz milikmu." };

  const quiz = await getQuizWithQuestions(sub.quizId);
  if (!quiz) return { error: "Quiz tidak ditemukan." };

  const answers = parseAnswers(sub.answers);

  // Kumpulkan penilaian essay dari form
  const feedback: EssayFeedbackDTO[] = [];
  let i = 0;
  while (true) {
    const qId = formData.get(`questionId_${i}`);
    if (qId === null) break;
    const qIdStr = String(qId);
    const question = quiz.questions.find((q) => q.id === qIdStr);
    const pointsRaw = formData.get(`points_${i}`);
    const commentRaw = formData.get(`comment_${i}`);
    i += 1;

    if (!question || question.type !== "essay") continue;
    const points = Number(pointsRaw);
    if (!Number.isFinite(points) || points < 0 || points > question.points) {
      return { error: `Poin soal harus antara 0 dan ${question.points}.` };
    }
    feedback.push({
      questionId: qIdStr,
      points,
      comment: typeof commentRaw === "string" ? commentRaw.trim() || undefined : undefined,
    });
  }

  if (feedback.length === 0) {
    return { error: "Tidak ada soal essay yang dinilai." };
  }

  const earnedEssay = feedback.reduce((sum, f) => sum + f.points, 0);
  const score = finalScore(quiz.questions, answers, earnedEssay);

  await db
    .update(quizSubmissions)
    .set({
      graded: true,
      score,
      passed: score >= quiz.passingScore,
      essayFeedback: JSON.stringify(feedback),
    })
    .where(eq(quizSubmissions.id, submissionId));

  // Terbitkan sertifikat otomatis bila siswa lulus setelah penilaian essay.
  if (score >= quiz.passingScore) {
    await issueCertificateForSubmission(submissionId);
  }

  revalidatePath("/instruktur/quiz");
  return { success: "Essay berhasil dinilai." };
}

/**
 * Ambil ringkasan semua attempt yang sudah disubmit untuk quiz tertentu.
 * (Untuk halaman riwayat & grading instruktur.)
 */
export async function listSubmissionsAction(quizId: string) {
  const user = await requireRole("instruktur");
  const [quiz] = await db
    .select({ id: quizzes.id, courseInstructor: courses.instructorId })
    .from(quizzes)
    .leftJoin(courses, eq(quizzes.courseId, courses.id))
    .where(eq(quizzes.id, quizId))
    .limit(1);
  if (!quiz || quiz.courseInstructor !== user.id) return [];

  return db
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
    .orderBy(asc(quizSubmissions.submittedAt));
}
