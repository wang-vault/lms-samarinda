"use client";

// Dialog nilai soal essay seorang siswa

import { useActionState, useEffect, useState } from "react";
import { gradeEssaysAction, type ActionState } from "@/actions/quizzes";

type GradingQuestion = {
  id: string;
  type: string;
  question: string;
  options: string[] | null;
  modelAnswer: string | null;
  points: number;
};

/** Ambil teks jawaban siswa dari JSON answers. */
function answerText(answersJson: string, questionId: string): string {
  try {
    const arr = JSON.parse(answersJson);
    if (!Array.isArray(arr)) return "";
    const found = arr.find(
      (a: { questionId?: string; answer?: unknown }) => a.questionId === questionId
    );
    if (!found) return "";
    return typeof found.answer === "string" ? found.answer : "";
  } catch {
    return "";
  }
}

export function EssayGradingDialog({
  submissionId,
  studentName,
  answers,
  questions,
}: {
  submissionId: string;
  studentName: string;
  answers: string;
  questions: GradingQuestion[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(
    gradeEssaysAction,
    {}
  );

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state.success]);

  const essayQuestions = questions.filter((q) => q.type === "essay");
  const pgQuestions = questions.filter((q) => q.type === "pilihan_ganda");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary text-sm"
      >
        Nilai Essay
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="card relative max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6">
            <h2 className="mb-1 text-lg font-bold">Nilai Essay — {studentName}</h2>
            <p className="mb-4 text-xs text-muted">
              Berikan poin untuk setiap soal essay. Nilai akhir dihitung dari
              poin PG + poin essay.
            </p>
            <form action={formAction} className="space-y-4">
              {state.error && (
                <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                  {state.error}
                </div>
              )}
              {state.success && (
                <div className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
                  {state.success}
                </div>
              )}

              <input type="hidden" name="submissionId" value={submissionId} />

              {pgQuestions.length > 0 && (
                <div className="rounded-lg bg-gray-50 p-3 text-xs text-muted dark:bg-gray-900">
                  {pgQuestions.length} soal pilihan ganda dinilai otomatis.
                  Hanya essay yang perlu dinilai manual di bawah ini.
                </div>
              )}

              {essayQuestions.map((q, i) => {
                const studentAnswer = answerText(answers, q.id);
                return (
                  <div
                    key={q.id}
                    className="rounded-lg border border-border p-4"
                  >
                    <div className="mb-2 flex items-center gap-2 text-xs">
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        Essay {i + 1}
                      </span>
                      <span className="rounded-full bg-accent-soft px-2.5 py-1 text-accent">
                        Maks {q.points} poin
                      </span>
                    </div>
                    <p className="mb-2 font-medium whitespace-pre-wrap">{q.question}</p>

                    <div className="mb-3 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-900">
                      <p className="mb-1 font-medium text-muted">Jawaban siswa:</p>
                      <p className="whitespace-pre-wrap">
                        {studentAnswer || (
                          <span className="italic text-muted">
                            (tidak dijawab)
                          </span>
                        )}
                      </p>
                    </div>

                    {q.modelAnswer && (
                      <div className="mb-3 rounded-lg border border-dashed border-border p-3 text-sm">
                        <p className="mb-1 font-medium text-muted">
                          Jawaban model:
                        </p>
                        <p className="whitespace-pre-wrap text-muted">
                          {q.modelAnswer}
                        </p>
                      </div>
                    )}

                    <input type="hidden" name={`questionId_${i}`} value={q.id} />
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <label
                        htmlFor={`points_${i}`}
                        className="text-sm font-medium sm:w-20"
                      >
                        Poin
                      </label>
                      <input
                        id={`points_${i}`}
                        name={`points_${i}`}
                        type="number"
                        min={0}
                        max={q.points}
                        step={0.5}
                        defaultValue={0}
                        required
                        className="input-field sm:max-w-[120px]"
                      />
                    </div>
                    <div className="mt-2">
                      <label
                        htmlFor={`comment_${i}`}
                        className="mb-1.5 block text-sm font-medium"
                      >
                        Komentar <span className="text-muted">(opsional)</span>
                      </label>
                      <textarea
                        id={`comment_${i}`}
                        name={`comment_${i}`}
                        rows={2}
                        maxLength={500}
                        placeholder="Feedback untuk siswa..."
                        className="input-field resize-none text-sm"
                      />
                    </div>
                  </div>
                );
              })}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-secondary text-sm"
                >
                  Batal
                </button>
                <button type="submit" className="btn-primary text-sm">
                  Simpan Nilai
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
