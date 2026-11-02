"use client";

// Tombol hapus quiz dengan konfirmasi

import { useTransition } from "react";
import { deleteQuizAction } from "@/actions/quizzes";

export function DeleteQuizButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    const ok = window.confirm(
      `Hapus quiz "${title}"? Semua soal dan hasil ujian akan terhapus.`
    );
    if (!ok) return;
    startTransition(async () => {
      await deleteQuizAction(id);
    });
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      title="Hapus quiz"
      className="rounded-lg border border-border px-2.5 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
    >
      {pending ? "…" : "🗑"}
    </button>
  );
}
