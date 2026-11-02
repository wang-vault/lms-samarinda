// Halaman kelola kursus milik instruktur
import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { courses, materials } from "@/db/schema";
import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import { CourseFormDialog } from "@/components/instruktur/course-form-dialog";
import { DeleteCourseButton } from "@/components/instruktur/delete-course-button";

export default async function InstrukturKursusPage() {
  const user = await requireRole("instruktur");

  const myCourses = await db
    .select({
      id: courses.id,
      title: courses.title,
      description: courses.description,
      createdAt: courses.createdAt,
    })
    .from(courses)
    .where(eq(courses.instructorId, user.id))
    .orderBy(desc(courses.createdAt));

  // Hitung materi per kursus
  const counts = await db
    .select({ courseId: materials.courseId })
    .from(materials);
  const countMap = new Map<string, number>();
  for (const m of counts) {
    countMap.set(m.courseId, (countMap.get(m.courseId) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader
        title="Kursus Saya"
        description="Buat dan kelola kursus yang kamu ajarkan."
        action={<CourseFormDialog mode="create" />}
      />

      {myCourses.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="mb-3 text-4xl">📚</div>
          <h3 className="mb-1 font-semibold">Belum ada kursus</h3>
          <p className="mb-4 text-sm text-muted">
            Buat kursus pertamamu untuk mulai mengunggah materi.
          </p>
          <CourseFormDialog mode="create" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {myCourses.map((c) => (
            <div key={c.id} className="card flex flex-col p-5">
              <h3 className="mb-1 font-semibold">{c.title}</h3>
              <p className="mb-3 line-clamp-2 flex-1 text-sm text-muted">
                {c.description || "Tanpa deskripsi"}
              </p>
              <p className="mb-3 text-xs text-muted">
                {countMap.get(c.id) ?? 0} materi
              </p>
              <div className="flex gap-2">
                <Link
                  href={`/instruktur/materi?courseId=${c.id}`}
                  className="btn-secondary flex-1 text-center text-sm"
                >
                  Kelola Materi
                </Link>
                <CourseFormDialog mode="edit" course={c} />
                <DeleteCourseButton id={c.id} title={c.title} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
