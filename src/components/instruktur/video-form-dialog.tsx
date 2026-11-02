"use client";

// Form unggah video baru ke sebuah kursus

import { useActionState, useEffect, useState } from "react";
import { createVideoAction, type ActionState } from "@/actions/videos";

type CourseOption = { id: string; title: string };

/** Format byte menjadi "1.2 MB" dll. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VideoFormDialog({
  courses,
  defaultCourseId,
}: {
  courses: CourseOption[];
  defaultCourseId: string;
}) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [state, formAction] = useActionState<ActionState, FormData>(
    createVideoAction,
    {}
  );

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      setFileName("");
      setFileSize(0);
    }
  }, [state.success]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary text-sm"
      >
        + Unggah Video
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="card relative max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
            <h2 className="mb-4 text-lg font-bold">Unggah Video Baru</h2>
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
                  Judul Video
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  required
                  maxLength={200}
                  placeholder="Misal: Video 1 - Cara Memulai Usaha"
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
                  placeholder="Penjelasan singkat tentang video ini..."
                  className="input-field resize-none"
                />
              </div>

              <div>
                <label htmlFor="orderIndex" className="mb-1.5 block text-sm font-medium">
                  Urutan <span className="text-muted">(opsional, kosongkan untuk ditaruh di akhir)</span>
                </label>
                <input
                  id="orderIndex"
                  name="orderIndex"
                  type="number"
                  min={0}
                  placeholder="0"
                  className="input-field"
                />
              </div>

              <div>
                <label htmlFor="file" className="mb-1.5 block text-sm font-medium">
                  File Video
                </label>
                <input
                  id="file"
                  name="file"
                  type="file"
                  accept="video/mp4,video/webm,.mp4,.webm"
                  required
                  onChange={(e) => {
                    setFileName(e.target.files?.[0]?.name ?? "");
                    setFileSize(e.target.files?.[0]?.size ?? 0);
                  }}
                  className="input-field file:mr-3 file:rounded file:border-0 file:bg-accent-soft file:px-3 file:py-1 file:text-accent"
                />
                {fileName && (
                  <p className="mt-1.5 truncate text-xs text-muted">
                    Terpilih: {fileName} ({fileSize > 0 ? formatBytes(fileSize) : "—"})
                  </p>
                )}
                <p className="mt-1.5 text-xs text-muted">
                  Format MP4 atau WebM, maksimal 500 MB.
                </p>
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
                  Unggah
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
