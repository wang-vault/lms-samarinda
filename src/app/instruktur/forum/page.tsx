// Halaman Forum Diskusi Instruktur (Daftar Kursus)

import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import { getForumCourses } from "@/lib/support-queries";
import Link from "next/link";

export const metadata = {
  title: "Forum Diskusi · Instruktur",
  description: "Pantau dan jawab pertanyaan diskusi siswa di setiap kursus.",
};

export default async function InstrukturForumPage() {
  await requireRole("instruktur");
  const courses = await getForumCourses();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Forum Diskusi Siswa"
        description="Pantau dan berikan bimbingan pada diskusi serta pertanyaan dari para siswa di kursus Anda."
      />

      {courses.length === 0 ? (
        <div className="card p-8 text-center text-muted">
          <span className="text-3xl block mb-2">💬</span>
          <p className="text-sm font-semibold text-foreground">
            Belum ada kursus aktif.
          </p>
          <p className="text-xs mt-1">
            Buat kursus terlebih dahulu agar forum diskusi dapat digunakan.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {courses.map((course) => (
            <div
              key={course.id}
              className="card p-5 flex flex-col justify-between hover:border-accent transition-all group"
            >
              <div>
                <span className="text-2xl block mb-2">📚</span>
                <h3 className="text-base font-bold text-foreground group-hover:text-accent transition-colors">
                  {course.title}
                </h3>
                <p className="text-xs text-muted mt-1.5 line-clamp-3">
                  {course.description || "Diskusi seputar pembelajaran kursus ini."}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted">Buka Diskusi</span>
                <Link
                  href={`/instruktur/forum/${course.id}`}
                  className="btn-primary text-xs py-1 px-3"
                >
                  Buka Forum →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
