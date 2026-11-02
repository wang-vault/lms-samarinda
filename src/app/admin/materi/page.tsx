// Halaman approval materi oleh admin

import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import { MaterialStatusBadge } from "@/components/shared/material-status-badge";
import { ApproveMaterialButton } from "@/components/admin/approve-material-button";
import { getMaterialsWithRelations } from "@/lib/material-queries";

export default async function AdminMateriPage() {
  await requireRole("admin");

  const allMaterials = await getMaterialsWithRelations();
  const pending = allMaterials.filter((m) => m.status === "pending");
  const decided = allMaterials.filter((m) => m.status !== "pending");

  return (
    <>
      <PageHeader
        title="Approval Materi"
        description="Sepuh materi yang diunggah instruktur sebelum tersedia untuk siswa."
      />

      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            Menunggu Persetujuan
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">
              {pending.length}
            </span>
          </h2>
          <div className="space-y-3">
            {pending.map((m) => (
              <div key={m.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg">
                        {m.type === "pdf" ? "📕" : "📝"}
                      </span>
                      <h3 className="font-medium">{m.title}</h3>
                      <MaterialStatusBadge status={m.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {m.course?.title ?? "Tanpa kursus"} · oleh{" "}
                      {m.creator?.name ?? "Tidak diketahui"} ·{" "}
                      {new Date(m.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <ApproveMaterialButton id={m.id} title={m.title} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-semibold">Riwayat Keputusan</h2>
        {decided.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted">
            Belum ada materi yang disetujui atau ditolak.
          </div>
        ) : (
          <div className="space-y-3">
            {decided.map((m) => (
              <div key={m.id} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg">
                        {m.type === "pdf" ? "📕" : "📝"}
                      </span>
                      <h3 className="font-medium">{m.title}</h3>
                      <MaterialStatusBadge status={m.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {m.course?.title ?? "Tanpa kursus"} · oleh{" "}
                      {m.creator?.name ?? "Tidak diketahui"}
                    </p>
                    {m.status === "rejected" && m.rejectionReason && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        Alasan: {m.rejectionReason}
                      </p>
                    )}
                  </div>
                  {m.status === "rejected" && (
                    <ApproveMaterialButton id={m.id} title={m.title} compact />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
