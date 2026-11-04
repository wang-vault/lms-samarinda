"use client";

// Form buat materi baru (teks atau PDF)

import { useActionState, useEffect, useState } from "react";
import { createMaterialAction, type ActionState } from "@/actions/materials";
import { Plus, FileEdit, FileText } from "lucide-react";

type CourseOption = { id: string; title: string };

export function MaterialFormDialog({
  courses,
  defaultCourseId,
}: {
  courses: CourseOption[];
  defaultCourseId: string;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"teks" | "pdf">("teks");
  const [state, formAction] = useActionState<ActionState, FormData>(
    createMaterialAction,
    {}
  );

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      setType("teks");
    }
  }, [state.success]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary inline-flex items-center gap-1.5 text-sm"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        <span>Tambah Materi</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="card relative max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
            <h2 className="mb-4 text-lg font-bold">Tambah Materi Baru</h2>
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

              <div>
                <label htmlFor="courseId" className="mb-1.5 block text-sm font-medium">
                  Kursus
                </label>
                <select
                  id="courseId"
                  name="courseId"
                  defaultValue={defaultCourseId}
                  className="input-field"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="title" className="mb-1.5 block text-sm font-medium">
                  Judul Materi
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  required
                  maxLength={200}
                  placeholder="Misal: Modul 1 - Pengenalan Kewirausahaan"
                  className="input-field"
                />
              </div>

              <div>
                <span className="mb-1.5 block text-sm font-medium">
                  Tipe Materi
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setType("teks")}
                    className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      type === "teks"
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border text-muted hover:text-foreground"
                    }`}
                  >
                    <FileEdit className="h-4 w-4" aria-hidden="true" />
                    <span>Teks</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("pdf")}
                    className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      type === "pdf"
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border text-muted hover:text-foreground"
                    }`}
                  >
                    <FileText className="h-4 w-4 text-red-500" aria-hidden="true" />
                    <span>PDF</span>
                  </button>
                </div>
                {/* Input tersembunyi agar server action terima "teks"/"pdf" */}
                <input type="hidden" name="type" value={type} />
              </div>

              {type === "teks" ? (
                <div>
                  <label htmlFor="content" className="mb-1.5 block text-sm font-medium">
                    Konten
                  </label>
                  <textarea
                    id="content"
                    name="content"
                    rows={8}
                    required
                    placeholder="Tulis isi materi di sini..."
                    className="input-field resize-none"
                  />
                </div>
              ) : (
                <div>
                  <label htmlFor="file" className="mb-1.5 block text-sm font-medium">
                    File PDF (maks 20 MB)
                  </label>
                  <input
                    id="file"
                    name="file"
                    type="file"
                    required
                    accept=".pdf,application/pdf"
                    className="input-field file:mr-3 file:rounded file:border-0 file:bg-accent-soft file:px-3 file:py-1 file:text-accent"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">
                  Simpan Materi
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-secondary"
                >
                  Batal
                </button>
              </div>

              <p className="text-xs text-muted">
                Materi akan berstatus <b>pending</b> hingga disetujui admin.
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
