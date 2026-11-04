// Halaman kelola video milik instruktur
import { eq, and, asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { courses, videos } from "@/db/schema";
import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import { VideoFormDialog } from "@/components/instruktur/video-form-dialog";
import { DeleteVideoButton } from "@/components/instruktur/delete-video-button";
import { formatDuration } from "@/lib/file-storage";
import Link from "next/link";
import { Video } from "lucide-react";

export default async function InstrukturVideoPage({
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
          title="Video Pembelajaran"
          description="Kelola video untuk kursus yang kamu ajar."
        />
        <div className="card p-10 text-center">
          <Video className="mx-auto mb-3 h-10 w-10 text-muted/60" aria-hidden="true" />
          <h3 className="mb-1 font-semibold">Belum ada kursus</h3>
          <p className="text-sm text-muted">
            Buat kursus terlebih dahulu di halaman{" "}
            <a href="/instruktur/kursus" className="text-accent hover:underline">
              Kursus Saya
            </a>{" "}
            sebelum menambahkan video.
          </p>
        </div>
      </>
    );
  }

  // Ambil video semua kursus milik instruktur (atau kursus terpilih saja)
  const myVideos = await db
    .select({
      id: videos.id,
      title: videos.title,
      description: videos.description,
      filePath: videos.filePath,
      durationSeconds: videos.durationSeconds,
      orderIndex: videos.orderIndex,
      createdAt: videos.createdAt,
      courseId: videos.courseId,
      courseTitle: courses.title,
    })
    .from(videos)
    .leftJoin(courses, eq(videos.courseId, courses.id))
    .where(
      courseId
        ? and(eq(videos.courseId, courseId), eq(courses.instructorId, user.id))
        : eq(courses.instructorId, user.id)
    )
    .orderBy(asc(videos.courseId), asc(videos.orderIndex));

  // Kelompokkan per kursus
  const grouped = new Map<string, { title: string; items: typeof myVideos }>();
  for (const v of myVideos) {
    const group = grouped.get(v.courseId) ?? { title: v.courseTitle ?? "?", items: [] };
    group.items.push(v);
    grouped.set(v.courseId, group);
  }

  return (
    <>
      <PageHeader
        title="Video Pembelajaran"
        description="Unggah dan kelola video untuk kursus yang kamu ajar."
        action={<VideoFormDialog courses={myCourses} defaultCourseId={courseId ?? myCourses[0].id} />}
      />

      {grouped.size === 0 ? (
        <div className="card p-10 text-center">
          <Video className="mx-auto mb-3 h-10 w-10 text-muted/60" aria-hidden="true" />
          <h3 className="mb-1 font-semibold">Belum ada video</h3>
          <p className="mb-4 text-sm text-muted">
            Unggah video pertamamu untuk melengkapi kursus.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {[...grouped.entries()].map(([cid, group]) => (
            <section key={cid}>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-semibold">{group.title}</h2>
                <Link
                  href={`/instruktur/video?courseId=${cid}`}
                  className="text-xs text-muted hover:text-accent"
                >
                  Filter kursus ini
                </Link>
              </div>
              <div className="grid gap-3">
                {group.items.map((v, i) => (
                  <div key={v.id} className="card flex flex-wrap items-center gap-4 p-4">
                    <div className="flex h-12 w-20 flex-none items-center justify-center rounded-lg bg-accent-soft text-xl text-accent">
                      <Video className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-medium">
                        <span className="text-muted">{i + 1}.</span> {v.title}
                      </h3>
                      <p className="truncate text-xs text-muted">
                        {v.description || "Tanpa deskripsi"} ·{" "}
                        {formatDuration(v.durationSeconds)} ·{" "}
                        <code className="text-[10px]">{v.filePath.slice(0, 8)}…</code>
                      </p>
                    </div>
                    <DeleteVideoButton id={v.id} title={v.title} />
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
