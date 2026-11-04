// Halaman daftar sertifikat siswa — hasil dari setiap ujian yang lulus.
// PDF sertifikat dibangun saat diminta lewat /api/sertifikat/[id]/pdf.

import Link from "next/link";
import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import {
  getStudentCertificates,
  formatIssueDate,
} from "@/lib/certificate-lib";
import { Award } from "lucide-react";

export default async function SiswaSertifikatPage() {
  const user = await requireRole("siswa");

  const certs = await getStudentCertificates(user.id);

  return (
    <>
      <PageHeader
        title="Sertifikat"
        description="Setiap ujian yang kamu lulus otomatis menerbitkan sertifikat. Unduh kapan saja dalam format PDF."
      />

      {certs.length === 0 ? (
        <div className="card p-10 text-center">
          <Award className="mx-auto mb-3 h-10 w-10 text-muted/60" aria-hidden="true" />
          <h3 className="mb-1 font-semibold">Belum ada sertifikat</h3>
          <p className="text-sm text-muted">
            Kerjakan ujian dan lulus untuk mendapatkan sertifikat pertamamu.
          </p>
          <Link
            href="/siswa/ujian"
            className="btn-primary mt-4 inline-block text-sm"
          >
            Lihat Daftar Ujian
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="card p-4">
              <p className="text-2xl font-bold">{certs.length}</p>
              <p className="text-xs text-muted">Total Sertifikat</p>
            </div>
            <div className="card p-4">
              <p className="text-2xl font-bold">
                {Math.max(...certs.map((c) => c.score))}
              </p>
              <p className="text-xs text-muted">Nilai Tertinggi</p>
            </div>
            <div className="card p-4 col-span-2 sm:col-span-1">
              <p className="text-2xl font-bold">
                {new Set(certs.map((c) => c.courseTitle)).size}
              </p>
              <p className="text-xs text-muted">Kursus Dilulusi</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {certs.map((c) => (
              <div key={c.id} className="card flex flex-col p-5">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
                    <Award className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs text-accent">
                    Nilai {c.score}
                  </span>
                </div>
                <h3 className="mb-1 font-semibold">{c.quizTitle}</h3>
                <p className="mb-1 line-clamp-1 flex-1 text-xs text-muted">
                  {c.courseTitle}
                </p>
                <p className="mb-3 text-xs text-muted">
                  Diterbitkan {formatIssueDate(c.issuedAt)}
                </p>
                <p className="mb-3 truncate font-mono text-[10px] text-muted">
                  {c.certificateNumber}
                </p>
                <div className="flex gap-2">
                  <Link
                    href={`/api/sertifikat/${c.id}/pdf`}
                    target="_blank"
                    className="btn-primary flex-1 text-center text-sm"
                  >
                    Lihat PDF
                  </Link>
                  <Link
                    href={`/api/sertifikat/${c.id}/pdf`}
                    download
                    className="btn-secondary flex-1 text-center text-sm"
                  >
                    Unduh
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
