// Halaman tonton video untuk sebuah kursus.
// Pemutar mencatat progres otomatis; daftar video di kursus yang sama ditampilkan di samping.

import { notFound } from "next/navigation";
import Link from "next/link";
import { asc, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { courses, videos, videoProgress } from "@/db/schema";
import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import { VideoPlayer } from "@/components/siswa/video-player";
import { formatDuration } from "@/lib/file-storage";
import { Video, CheckCircle2 } from "lucide-react";

export default async function SiswaVideoWatchPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const user = await requireRole("siswa");
  const { courseId } = await params;

  // Pastikan kursusnya ada
  const [course] = await db
    .select({ id: courses.id, title: courses.title, description: courses.description })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  if (!course) notFound();

  // Ambil semua video kursus ini beserta progres pengguna yang login
  const rows = await db
    .select({
      id: videos.id,
      title: videos.title,
      description: videos.description,
      filePath: videos.filePath,
      durationSeconds: videos.durationSeconds,
      orderIndex: videos.orderIndex,
      watched: videoProgress.watched,
      watchedSeconds: videoProgress.watchedSeconds,
    })
    .from(videos)
    .leftJoin(
      videoProgress,
      and(eq(videoProgress.videoId, videos.id), eq(videoProgress.userId, user.id))
    )
    .where(eq(videos.courseId, courseId))
    .orderBy(asc(videos.orderIndex), asc(videos.createdAt));

  return (
    <>
      <PageHeader
        title={course.title}
        description={course.description || "Tonton semua video di kursus ini."}
      />

      <div className="mb-4">
        <Link
          href="/siswa/video"
          className="text-sm text-muted hover:text-accent"
        >
          ← Kembali ke daftar video
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="card p-10 text-center">
          <Video className="mx-auto mb-3 h-10 w-10 text-muted/60" aria-hidden="true" />
          <h3 className="mb-1 font-semibold">Belum ada video di kursus ini</h3>
          <p className="text-sm text-muted">
            Instruktur belum menambahkan video untuk kursus ini.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {rows.map((v, i) => (
            <section key={v.id} className="card p-5">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">
                  <span className="text-muted">{i + 1}.</span> {v.title}
                </h2>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                  <span>{formatDuration(v.durationSeconds)}</span>
                  {v.watched && (
                    <span className="inline-flex items-center gap-1 font-medium text-green-600 dark:text-green-400">
                      · <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Selesai
                    </span>
                  )}
                </span>
              </div>
              {v.description && (
                <p className="mb-3 text-sm text-muted">{v.description}</p>
              )}
              <VideoPlayer
                videoId={v.id}
                filePath={v.filePath}
                title={v.title}
                initialWatchedSeconds={v.watchedSeconds ?? 0}
                initialWatched={v.watched ?? false}
              />
            </section>
          ))}
        </div>
      )}
    </>
  );
}
