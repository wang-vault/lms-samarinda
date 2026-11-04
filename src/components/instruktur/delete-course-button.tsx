"use client";

// Tombol hapus kursus dengan konfirmasi

import { useTransition } from "react";
import { deleteCourseAction } from "@/actions/materials";
import { Trash2 } from "lucide-react";

export function DeleteCourseButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    const ok = window.confirm(`Hapus kursus "${title}"? Semua materinya akan terhapus.`);
    if (!ok) return;
    startTransition(async () => {
      await deleteCourseAction(id);
    });
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      aria-label={`Hapus kursus ${title}`}
      title="Hapus kursus"
      className="inline-flex items-center justify-center rounded-lg border border-border p-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
    >
      {pending ? "…" : <Trash2 className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}
