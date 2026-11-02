"use client";

// Form tambah / edit soal quiz (pilihan ganda atau essay)

import { useActionState, useEffect, useState } from "react";
import {
  addQuestionAction,
  updateQuestionAction,
  type ActionState,
} from "@/actions/quizzes";

export type QuestionData = {
  id: string;
  type: "pilihan_ganda" | "essay";
  question: string;
  options: string[] | null;
  correctOptionIndex: number | null;
  modelAnswer: string | null;
  points: number;
};

export function QuestionFormDialog({
  quizId,
  question,
}: {
  quizId: string;
  question?: QuestionData;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"pilihan_ganda" | "essay">(
    question?.type ?? "pilihan_ganda"
  );
  const [optionCount, setOptionCount] = useState<number>(
    question?.options?.length ?? 2
  );
  const action = question ? updateQuestionAction : addQuestionAction;
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      // Reset state internal setelah sukses (default untuk soal berikutnya)
      setType("pilihan_ganda");
      setOptionCount(2);
    }
  }, [state.success]);

  const label = question ? "Edit Soal" : "+ Tambah Soal";
  const existingOptions = question?.options ?? [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={question ? "btn-secondary text-sm" : "btn-primary text-sm"}
      >
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="card relative max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
            <h2 className="mb-4 text-lg font-bold">
              {question ? "Edit Soal" : "Tambah Soal"}
            </h2>
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

              <input type="hidden" name="quizId" value={quizId} />
              {question && <input type="hidden" name="id" value={question.id} />}

              <div>
                <label htmlFor="type" className="mb-1.5 block text-sm font-medium">
                  Tipe Soal
                </label>
                <select
                  id="type"
                  name="type"
                  value={type}
                  onChange={(e) => setType(e.target.value as typeof type)}
                  className="input-field"
                  disabled={!!question}
                >
                  <option value="pilihan_ganda">Pilihan Ganda</option>
                  <option value="essay">Essay</option>
                </select>
                {question && (
                  <p className="mt-1.5 text-xs text-muted">
                    Tipe soal tidak bisa diubah setelah dibuat.
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="question"
                  className="mb-1.5 block text-sm font-medium"
                >
                  Pertanyaan
                </label>
                <textarea
                  id="question"
                  name="question"
                  rows={3}
                  required
                  defaultValue={question?.question ?? ""}
                  placeholder="Tulis pertanyaan di sini..."
                  className="input-field resize-none"
                />
              </div>

              {type === "pilihan_ganda" && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    Pilihan Jawaban
                  </label>
                  {Array.from({ length: optionCount }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correctOptionIndex"
                        value={i}
                        defaultChecked={question?.correctOptionIndex === i}
                        className="size-4 shrink-0 accent-accent"
                        title="Tandai sebagai jawaban benar"
                      />
                      <input
                        name={`option_${i}`}
                        type="text"
                        required
                        maxLength={200}
                        defaultValue={existingOptions[i] ?? ""}
                        placeholder={`Pilihan ${String.fromCharCode(65 + i)}`}
                        className="input-field"
                      />
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    {optionCount < 10 && (
                      <button
                        type="button"
                        onClick={() => setOptionCount((n) => n + 1)}
                        className="text-xs text-accent hover:underline"
                      >
                        + Tambah pilihan
                      </button>
                    )}
                    {optionCount > 2 && (
                      <button
                        type="button"
                        onClick={() => setOptionCount((n) => n - 1)}
                        className="text-xs text-muted hover:underline"
                      >
                        − Hapus pilihan terakhir
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted">
                    Pilih radio button di sebelah kiri untuk menandai jawaban
                    yang benar. Minimal 2 pilihan.
                  </p>
                </div>
              )}

              {type === "essay" && (
                <div>
                  <label
                    htmlFor="modelAnswer"
                    className="mb-1.5 block text-sm font-medium"
                  >
                    Jawaban Model / Kunci <span className="text-muted">(opsional)</span>
                  </label>
                  <textarea
                    id="modelAnswer"
                    name="modelAnswer"
                    rows={4}
                    maxLength={1000}
                    defaultValue={question?.modelAnswer ?? ""}
                    placeholder="Jawaban referensi untuk membantu penilaian essay..."
                    className="input-field resize-none"
                  />
                  <p className="mt-1.5 text-xs text-muted">
                    Jawaban model hanya dilihat oleh instruktur saat menilai,
                    tidak ditampilkan ke siswa.
                  </p>
                </div>
              )}

              <div>
                <label htmlFor="points" className="mb-1.5 block text-sm font-medium">
                  Poin
                </label>
                <input
                  id="points"
                  name="points"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={question?.points ?? 1}
                  className="input-field"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-secondary text-sm"
                >
                  Batal
                </button>
                <button type="submit" className="btn-primary text-sm">
                  {question ? "Simpan" : "Tambah"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
