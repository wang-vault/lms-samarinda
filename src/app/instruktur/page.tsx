// Dashboard instruktur
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { courses, materials, videos, quizzes, quizSubmissions } from "@/db/schema";
import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import { BookOpen, FileText, ClipboardList, Clock } from "lucide-react";

export default async function InstrukturDashboardPage() {
  const user = await requireRole("instruktur");

  const [myCourses, myMaterials, myVideos, myQuizzes, ungraded] = await Promise.all([
    db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.instructorId, user.id)),
    db
      .select({ id: materials.id, status: materials.status })
      .from(materials)
      .where(eq(materials.createdBy, user.id)),
    db
      .select({ id: videos.id })
      .from(videos)
      .where(eq(videos.createdBy, user.id)),
    // Quiz milik instruktur ini (lewat kursus yang dia buat)
    db
      .select({ id: quizzes.id })
      .from(quizzes)
      .innerJoin(courses, eq(quizzes.courseId, courses.id))
      .where(eq(courses.instructorId, user.id)),
    // Submission butuh penilaian essay pada quiz instruktur ini
    db
      .select({ id: quizSubmissions.id })
      .from(quizSubmissions)
      .innerJoin(quizzes, eq(quizSubmissions.quizId, quizzes.id))
      .innerJoin(courses, eq(quizzes.courseId, courses.id))
      .where(
        and(
          eq(courses.instructorId, user.id),
          eq(quizSubmissions.status, "submitted"),
          eq(quizSubmissions.graded, false)
        )
      ),
  ]);

  const approvedCount = myMaterials.filter((m) => m.status === "approved").length;

  return (
    <>
      <PageHeader
        title={`Halo, ${user.name}`}
        description="Kelola kursus, materi, dan ujian yang kamu buat."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Kursus Saya",
            value: myCourses.length,
            icon: <BookOpen className="h-5 w-5" aria-hidden="true" />,
          },
          {
            label: "Materi Dibuat",
            value: myMaterials.length,
            icon: <FileText className="h-5 w-5" aria-hidden="true" />,
          },
          {
            label: "Quiz Dibuat",
            value: myQuizzes.length,
            icon: <ClipboardList className="h-5 w-5" aria-hidden="true" />,
          },
          {
            label: "Menunggu Penilaian",
            value: ungraded.length,
            icon: <Clock className="h-5 w-5" aria-hidden="true" />,
          },
        ].map((stat) => (
          <div key={stat.label} className="card p-5">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
              {stat.icon}
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-sm text-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="card mt-6 p-6">
        <h2 className="mb-2 font-semibold">Mulai mengajar</h2>
        <p className="text-sm text-muted">
          {myCourses.length === 0
            ? "Buat kursus pertamamu untuk mulai mengunggah materi."
            : `${approvedCount} materimu sudah disetujui dan dapat diakses siswa.`}{" "}
          <Link href="/instruktur/kursus" className="text-accent hover:underline">
            Kelola kursus
          </Link>
        </p>
        {myCourses.length > 0 && (
          <>
            <p className="mt-2 text-sm text-muted">
              {myVideos.length === 0
                ? "Belum ada video diunggah. "
                : `${myVideos.length} video sudah tersedia untuk siswa. `}
              <Link href="/instruktur/video" className="text-accent hover:underline">
                Kelola video
              </Link>
            </p>
            <p className="mt-2 text-sm text-muted">
              {myQuizzes.length === 0
                ? "Belum ada quiz dibuat. "
                : `${myQuizzes.length} quiz sudah kamu buat`}
              {ungraded.length > 0 && ` • ${ungraded.length} ujian menunggu dinilai`}
              {". "}
              <Link href="/instruktur/quiz" className="text-accent hover:underline">
                Kelola quiz
              </Link>
            </p>
          </>
        )}
      </div>
    </>
  );
}
