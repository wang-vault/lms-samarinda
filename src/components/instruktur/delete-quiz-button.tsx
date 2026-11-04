"use client";

// Tombol hapus quiz dengan konfirmasi

import { useTransition } from "react";
import { deleteQuizAction } from "@/actions/quizzes";
import { Trash2 } from "lucide-react";

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
      aria-label={`Hapus quiz ${title}`}
      title="Hapus quiz"
      className="inline-flex items-center justify-center rounded-lg border border-border p-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
    >
      {pending ? "…" : <Trash2 className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}
