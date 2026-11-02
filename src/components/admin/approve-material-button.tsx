"use client";

// Tombol approve (setujui) dan form reject (tolak) materi oleh admin

import { useState, useTransition } from "react";
import { approveMaterialAction, rejectMaterialAction } from "@/actions/materials";

export function ApproveMaterialButton({
  id,
  title,
  compact,
}: {
  id: string;
  title: string;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      await approveMaterialAction(id);
    });
  }

  function handleReject() {
    const reason = window.prompt(
      `Alasan penolakan materi "${title}":`,
      "Konten belum sesuai dengan kurikulum."
    );
    if (reason === null) return; // batal
    if (!reason.trim()) {
      window.alert("Alasan penolakan wajib diisi.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await rejectMaterialAction(id, reason);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={handleApprove}
        disabled={pending}
        className={compact ? "btn-secondary text-xs" : "btn-primary text-sm"}
      >
        {pending ? "Memproses..." : "✓ Setujui"}
      </button>
      <button
        type="button"
        onClick={handleReject}
        disabled={pending}
        className="rounded-lg border border-border px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
      >
        ✗ Tolak
      </button>
      {error && (
        <p className="self-center text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
