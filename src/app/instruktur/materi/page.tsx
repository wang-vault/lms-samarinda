// Halaman kelola materi milik instruktur
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { courses, materials } from "@/db/schema";
import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import { MaterialFormDialog } from "@/components/instruktur/material-form-dialog";
import { DeleteMaterialButton } from "@/components/instruktur/delete-material-button";
import { MaterialStatusBadge } from "@/components/shared/material-status-badge";
import { FileText, FileEdit } from "lucide-react";

export default async function InstrukturMateriPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string }>;
}) {
  const user = await requireRole("instruktur");
  const { courseId } = await searchParams;

  const myCourses = await db
    .select({ id: courses.id, title: courses.title })
    .from(courses)
    .where(eq(courses.instructorId, user.id))
    .orderBy(desc(courses.createdAt));

  if (myCourses.length === 0) {
    return (
      <>
        <PageHeader
          title="Materi Saya"
          description="Kelola materi pembelajaran yang kamu buat."
        />
        <div className="card p-10 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-muted/60" aria-hidden="true" />
          <h3 className="mb-1 font-semibold">Belum ada kursus</h3>
          <p className="text-sm text-muted">
            Buat kursus terlebih dahulu di halaman{" "}
            <a href="/instruktur/kursus" className="text-accent hover:underline">
              Kursus Saya
            </a>{" "}
            sebelum menambahkan materi.
          </p>
        </div>
      </>
    );
  }

  // Ambil materi: semua milik instruktur, atau filter per kursus
  const mats = await db
    .select({
      id: materials.id,
      title: materials.title,
      type: materials.type,
      status: materials.status,
      rejectionReason: materials.rejectionReason,
      createdAt: materials.createdAt,
      courseTitle: courses.title,
    })
    .from(materials)
    .leftJoin(courses, eq(materials.courseId, courses.id))
    .where(eq(materials.createdBy, user.id))
    .orderBy(desc(materials.createdAt));

  const visible = courseId
    ? mats.filter(
        (m) => myCourses.some((c) => c.id === courseId) && m.courseTitle !== null
      )
    : mats;

  const activeCourse = myCourses.find((c) => c.id === courseId);

  return (
    <>
      <PageHeader
        title="Materi Saya"
        description={
          activeCourse
            ? `Materi untuk kursus "${activeCourse.title}"`
            : "Kelola materi pembelajaran yang kamu buat."
        }
        action={
          <MaterialFormDialog
            courses={myCourses}
            defaultCourseId={courseId ?? myCourses[0].id}
          />
        }
      />

      {/* Filter kursus */}
      <div className="mb-5 flex flex-wrap gap-2">
        <a
          href="/instruktur/materi"
          className={`rounded-full border px-3 py-1 text-sm transition-colors ${
            !courseId
              ? "border-accent bg-accent-soft text-accent"
              : "border-border text-muted hover:text-foreground"
          }`}
        >
          Semua Kursus
        </a>
        {myCourses.map((c) => (
          <a
            key={c.id}
            href={`/instruktur/materi?courseId=${c.id}`}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              courseId === c.id
                ? "border-accent bg-accent-soft text-accent"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {c.title}
          </a>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="card p-10 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-muted/60" aria-hidden="true" />
          <h3 className="mb-1 font-semibold">Belum ada materi</h3>
          <p className="text-sm text-muted">
            Tambahkan materi teks atau PDF untuk kursus pertamamu.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((m) => (
            <div key={m.id} className="card flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-lg">
                {m.type === "pdf" ? (
                  <FileText className="h-5 w-5 text-red-500" aria-hidden="true" />
                ) : (
                  <FileEdit className="h-5 w-5 text-accent" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate font-medium">{m.title}</h3>
                  <MaterialStatusBadge status={m.status} />
                </div>
                <p className="truncate text-xs text-muted">
                  {m.courseTitle} · dibuat{" "}
                  {new Date(m.createdAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                {m.status === "rejected" && m.rejectionReason && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    Ditolak: {m.rejectionReason}
                  </p>
                )}
              </div>
              <DeleteMaterialButton id={m.id} title={m.title} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
