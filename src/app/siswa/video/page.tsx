// Halaman daftar video pembelajaran untuk siswa
// Menampilkan kursus-kursus yang memiliki video beserta progres penonton.

import Link from "next/link";
import { asc, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { courses, videos, videoProgress } from "@/db/schema";
import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import { formatDuration } from "@/lib/file-storage";

export default async function SiswaVideoPage() {
  const user = await requireRole("siswa");

  // Ambil semua video bersama kursusnya dan progres pengguna ini
  const rows = await db
    .select({
      courseId: courses.id,
      courseTitle: courses.title,
      courseDescription: courses.description,
      videoId: videos.id,
      videoTitle: videos.title,
      durationSeconds: videos.durationSeconds,
      watched: videoProgress.watched,
    })
    .from(videos)
    .innerJoin(courses, eq(videos.courseId, courses.id))
    .leftJoin(
      videoProgress,
      and(eq(videoProgress.videoId, videos.id), eq(videoProgress.userId, user.id))
    )
    .orderBy(asc(courses.title), asc(videos.orderIndex));

  // Kelompokkan per kursus dan hitung progres
  const grouped = new Map<
    string,
    {
      title: string;
      description: string;
      total: number;
      watchedCount: number;
      totalSeconds: number;
    }
  >();

  for (const r of rows) {
    const g = grouped.get(r.courseId) ?? {
      title: r.courseTitle,
      description: r.courseDescription,
      total: 0,
      watchedCount: 0,
      totalSeconds: 0,
    };
    g.total += 1;
    g.totalSeconds += r.durationSeconds;
    if (r.watched) g.watchedCount += 1;
    grouped.set(r.courseId, g);
  }

  return (
    <>
      <PageHeader
        title="Video Pembelajaran"
        description="Tonton video untuk setiap kursus. Progres tersimpan otomatis."
      />

      {grouped.size === 0 ? (
        <div className="card p-10 text-center">
          <div className="mb-3 text-4xl">🎥</div>
          <h3 className="mb-1 font-semibold">Belum ada video tersedia</h3>
          <p className="text-sm text-muted">
            Video akan muncul setelah instruktur mengunggahnya.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {[...grouped.entries()].map(([courseId, g]) => {
            const percent = g.total > 0 ? Math.round((g.watchedCount / g.total) * 100) : 0;
            return (
              <Link
                key={courseId}
                href={`/siswa/video/${courseId}`}
                className="card flex flex-col p-5 transition-shadow hover:shadow-md"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{g.title}</h3>
                  <span className="text-2xl">🎥</span>
                </div>
                <p className="mb-3 flex-1 text-xs text-muted line-clamp-2">
                  {g.description || "Tanpa deskripsi"}
                </p>
                <p className="mb-2 text-xs text-muted">
                  {g.total} video · {formatDuration(g.totalSeconds)} total
                </p>
                <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="text-xs text-muted">
                  {g.watchedCount}/{g.total} selesai ({percent}%)
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
