"use client";

// Tombol hapus soal quiz dengan konfirmasi

import { useTransition } from "react";
import { deleteQuestionAction } from "@/actions/quizzes";
import { Trash2 } from "lucide-react";

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
      aria-label="Hapus soal"
      title="Hapus soal"
      className="inline-flex items-center justify-center rounded-lg border border-border p-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
    >
      {pending ? "…" : <Trash2 className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}
