// Halaman daftar sertifikat yang diterbitkan dari kursus instruktur.
// Sertifikat otomatis diterbitkan saat siswa lulus ujian.

import Link from "next/link";
import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import {
  getInstructorCertificates,
  formatIssueDate,
} from "@/lib/certificate-lib";

export default async function InstrukturSertifikatPage() {
  const user = await requireRole("instruktur");

  const certs = await getInstructorCertificates(user.id);

  // Kelompokkan per kursus untuk memudahkan pembacaan.
  const byCourse = new Map<string, typeof certs>();
  for (const c of certs) {
    const key = c.courseTitle ?? "Tanpa Kursus";
    if (!byCourse.has(key)) byCourse.set(key, []);
    byCourse.get(key)!.push(c);
  }

  return (
    <>
      <PageHeader
        title="Sertifikat"
        description="Sertifikat yang diterbitkan otomatis setiap kali siswa lulus ujian di kursusmu."
      />

      {certs.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="mb-3 text-4xl">🏆</div>
          <h3 className="mb-1 font-semibold">Belum ada sertifikat diterbitkan</h3>
          <p className="text-sm text-muted">
            Sertifikat akan muncul di sini setelah siswa lulus ujian di kursusmu.
          </p>
          <Link
            href="/instruktur/quiz"
            className="btn-primary mt-4 inline-block text-sm"
          >
            Kelola Ujian
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
                {new Set(certs.map((c) => c.userName)).size}
              </p>
              <p className="text-xs text-muted">Siswa Lulus</p>
            </div>
            <div className="card p-4 col-span-2 sm:col-span-1">
              <p className="text-2xl font-bold">
                {new Set(certs.map((c) => c.courseTitle)).size}
              </p>
              <p className="text-xs text-muted">Kursus Terkait</p>
            </div>
          </div>

          <div className="space-y-8">
            {[...byCourse.entries()].map(([courseTitle, items]) => (
              <section key={courseTitle}>
                <h2 className="mb-3 flex items-center gap-2 font-semibold">
                  <span>📚</span> {courseTitle}
                </h2>
                <div className="card overflow-hidden p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-border bg-gray-50 text-xs text-muted dark:bg-gray-900">
                        <tr>
                          <th className="px-4 py-3 font-medium">Siswa</th>
                          <th className="px-4 py-3 font-medium">Ujian</th>
                          <th className="px-4 py-3 font-medium">Nilai</th>
                          <th className="px-4 py-3 font-medium">Tanggal</th>
                          <th className="px-4 py-3 font-medium">No. Sertifikat</th>
                          <th className="px-4 py-3 font-medium">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {items.map((c) => (
                          <tr key={c.id}>
                            <td className="px-4 py-3 font-medium">{c.userName}</td>
                            <td className="px-4 py-3 text-muted">{c.quizTitle}</td>
                            <td className="px-4 py-3">
                              <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs text-accent">
                                {c.score}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted">
                              {formatIssueDate(c.issuedAt)}
                            </td>
                            <td className="px-4 py-3 font-mono text-[10px] text-muted">
                              {c.certificateNumber}
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/api/sertifikat/${c.id}/pdf`}
                                target="_blank"
                                className="text-sm font-medium text-accent hover:underline"
                              >
                                Lihat PDF
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
