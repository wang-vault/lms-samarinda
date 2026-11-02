// Badge status materi: pending / approved / rejected

import type { MaterialStatus } from "@/db/schema";

const STYLES: Record<MaterialStatus, { label: string; className: string }> = {
  pending: {
    label: "Menunggu",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  approved: {
    label: "Disetujui",
    className: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
  rejected: {
    label: "Ditolak",
    className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
};

export function MaterialStatusBadge({ status }: { status: MaterialStatus }) {
  const s = STYLES[status];
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}
    >
      {s.label}
    </span>
  );
}
