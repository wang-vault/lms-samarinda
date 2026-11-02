"use client";

// Tombol hapus soal quiz dengan konfirmasi

import { useTransition } from "react";
import { deleteQuestionAction } from "@/actions/quizzes";

export function DeleteQuestionButton({
  id,
  question,
}: {
  id: string;
  question: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    const trimmed = question.length > 60 ? question.slice(0, 60) + "…" : question;
    const ok = window.confirm(`Hapus soal "${trimmed}"?`);
    if (!ok) return;
    startTransition(async () => {
      await deleteQuestionAction(id);
    });
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      title="Hapus soal"
      className="rounded-lg border border-border px-2.5 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
    >
      {pending ? "…" : "🗑"}
    </button>
  );
}
