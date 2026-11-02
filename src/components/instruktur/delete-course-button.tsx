"use client";

// Tombol hapus kursus dengan konfirmasi

import { useTransition } from "react";
import { deleteCourseAction } from "@/actions/materials";

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
      title="Hapus kursus"
      className="rounded-lg border border-border px-2.5 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
    >
      {pending ? "…" : "🗑"}
    </button>
  );
}
