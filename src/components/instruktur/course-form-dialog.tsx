"use client";

// Dialog form buat / edit kursus (inline, tanpa navigation)

import { useActionState, useEffect, useState } from "react";
import {
  createCourseAction,
  updateCourseAction,
  type ActionState,
} from "@/actions/materials";
import { Pencil, Plus } from "lucide-react";

type CourseData = {
  id: string;
  title: string;
  description: string | null;
};

export function CourseFormDialog({
  mode,
  course,
}: {
  mode: "create" | "edit";
  course?: CourseData;
}) {
  const [open, setOpen] = useState(false);
  const action = mode === "create" ? createCourseAction : updateCourseAction;
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  // Tutup dialog saat sukses
  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state.success]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={mode === "create" ? "Buat Kursus" : "Edit Kursus"}
        title={mode === "create" ? "Buat Kursus" : "Edit Kursus"}
        className={
          mode === "create"
            ? "btn-primary inline-flex items-center gap-1.5 text-sm"
            : "btn-secondary inline-flex items-center justify-center p-2 text-sm"
        }
      >
        {mode === "create" ? (
          <>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Buat Kursus</span>
          </>
        ) : (
          <Pencil className="h-4 w-4" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="card relative w-full max-w-md p-6">
            <h2 className="mb-4 text-lg font-bold">
              {mode === "create" ? "Buat Kursus Baru" : "Edit Kursus"}
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

              {mode === "edit" && course && (
                <input type="hidden" name="id" value={course.id} />
              )}

              <div>
                <label htmlFor="title" className="mb-1.5 block text-sm font-medium">
                  Judul Kursus
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  required
                  maxLength={200}
                  defaultValue={course?.title ?? ""}
                  placeholder="Misal: Dasar Kewirausahaan"
                  className="input-field"
                />
              </div>

              <div>
                <label htmlFor="description" className="mb-1.5 block text-sm font-medium">
                  Deskripsi
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  defaultValue={course?.description ?? ""}
                  placeholder="Deskripsi singkat kursus..."
                  className="input-field resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">
                  {mode === "create" ? "Buat" : "Simpan"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-secondary"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
