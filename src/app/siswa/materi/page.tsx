// Halaman materi untuk siswa — hanya yang sudah approved

import Link from "next/link";
import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import { getApprovedMaterials } from "@/lib/material-queries";

export default async function SiswaMateriPage() {
  await requireRole("siswa");

  const mats = await getApprovedMaterials();

  // Kelompokkan per kursus
  const byCourse = new Map<string, typeof mats>();
  for (const m of mats) {
    const key = m.course?.title ?? "Tanpa Kursus";
    if (!byCourse.has(key)) byCourse.set(key, []);
    byCourse.get(key)!.push(m);
  }

  return (
    <>
      <PageHeader
        title="Materi Belajar"
        description="Semua materi di bawah ini sudah disetujui dan siap dipelajari."
      />

      {mats.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="mb-3 text-4xl">📚</div>
          <h3 className="mb-1 font-semibold">Belum ada materi tersedia</h3>
          <p className="text-sm text-muted">
            Materi akan muncul setelah instruktur mengunggah dan admin
            menyetujuinya.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {[...byCourse.entries()].map(([courseTitle, items]) => (
            <section key={courseTitle}>
              <h2 className="mb-3 flex items-center gap-2 font-semibold">
                <span>📚</span> {courseTitle}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((m) => (
                  <div key={m.id} className="card flex flex-col p-5">
                    <div className="mb-2 text-2xl">
                      {m.type === "pdf" ? "📕" : "📝"}
                    </div>
                    <h3 className="mb-1 font-medium">{m.title}</h3>
                    <p className="mb-3 flex-1 text-xs text-muted">
                      oleh {m.creator?.name ?? "Instruktur"}
                    </p>
                    {m.type === "pdf" ? (
                      <Link
                        href={`/siswa/materi/${m.id}`}
                        className="btn-primary text-center text-sm"
                      >
                        Baca PDF
                      </Link>
                    ) : (
                      <Link
                        href={`/siswa/materi/${m.id}`}
                        className="btn-secondary text-center text-sm"
                      >
                        Baca Materi
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
