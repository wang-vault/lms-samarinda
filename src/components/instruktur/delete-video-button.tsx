"use client";

// Tombol hapus video dengan konfirmasi

import { useTransition } from "react";
import { deleteVideoAction } from "@/actions/videos";
import { Trash2 } from "lucide-react";

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
      aria-label={`Hapus video ${title}`}
      title="Hapus video"
      className="inline-flex items-center justify-center rounded-lg border border-border p-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
    >
      {pending ? "…" : <Trash2 className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}
