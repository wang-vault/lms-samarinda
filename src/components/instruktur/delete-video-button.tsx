"use client";

// Tombol hapus video dengan konfirmasi

import { useTransition } from "react";
import { deleteVideoAction } from "@/actions/videos";

export function DeleteVideoButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    const ok = window.confirm(`Hapus video "${title}"? File video juga akan dihapus.`);
    if (!ok) return;
    startTransition(async () => {
      await deleteVideoAction(id);
    });
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      title="Hapus video"
      className="rounded-lg border border-border px-2.5 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
    >
      {pending ? "…" : "🗑"}
    </button>
  );
}
