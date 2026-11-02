"use client";

// Form buat / edit quiz (metadata saja; soal dikelola di halaman quiz)

import { useActionState, useEffect, useState } from "react";
import {
  createQuizAction,
  updateQuizAction,
  type ActionState,
} from "@/actions/quizzes";

type CourseOption = { id: string; title: string };

type QuizData = {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  passingScore: number;
};

export function QuizFormDialog({
  mode,
  courses,
  quiz,
}: {
  mode: "create" | "edit";
  courses: CourseOption[];
  quiz?: QuizData;
}) {
  const [open, setOpen] = useState(false);
  const action = mode === "create" ? createQuizAction : updateQuizAction;
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state.success]);

  const label = mode === "create" ? "+ Buat Quiz" : "Edit";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={mode === "create" ? "btn-primary text-sm" : "btn-secondary text-sm"}
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
              {mode === "create" ? "Buat Quiz Baru" : "Edit Quiz"}
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

              {mode === "create" && (
                <div>
                  <label htmlFor="courseId" className="mb-1.5 block text-sm font-medium">
                    Kursus
                  </label>
                  <select
                    id="courseId"
                    name="courseId"
                    required
                    className="input-field"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {mode === "edit" && quiz && (
                <input type="hidden" name="id" value={quiz.id} />
              )}

              <div>
                <label htmlFor="title" className="mb-1.5 block text-sm font-medium">
                  Judul Quiz
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  required
                  maxLength={200}
                  defaultValue={quiz?.title ?? ""}
                  placeholder="Misal: Ujian Akhir - Modul 1"
                  className="input-field"
                />
              </div>

              <div>
                <label htmlFor="description" className="mb-1.5 block text-sm font-medium">
                  Deskripsi <span className="text-muted">(opsional)</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  maxLength={500}
                  defaultValue={quiz?.description ?? ""}
                  placeholder="Penjelasan singkat tentang ujian ini..."
                  className="input-field resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="durationMinutes"
                    className="mb-1.5 block text-sm font-medium"
                  >
                    Durasi (menit)
                  </label>
                  <input
                    id="durationMinutes"
                    name="durationMinutes"
                    type="number"
                    min={1}
                    max={300}
                    defaultValue={quiz?.durationMinutes ?? 30}
                    className="input-field"
                  />
                </div>
                <div>
                  <label
                    htmlFor="passingScore"
                    className="mb-1.5 block text-sm font-medium"
                  >
                    KKM (0-100)
                  </label>
                  <input
                    id="passingScore"
                    name="passingScore"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={quiz?.passingScore ?? 70}
                    className="input-field"
                  />
                </div>
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
                  {mode === "create" ? "Buat" : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
