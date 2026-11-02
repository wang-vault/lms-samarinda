// Dashboard siswa
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { materials, videoProgress, quizSubmissions } from "@/db/schema";
import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";

export default async function SiswaDashboardPage() {
  const user = await requireRole("siswa");

  const approved = await db
    .select({ id: materials.id })
    .from(materials)
    .where(eq(materials.status, "approved"));

  // Hitung video yang sudah selesai ditonton pengguna ini
  const watchedVideos = await db
    .select({ id: videoProgress.id })
    .from(videoProgress)
    .where(and(eq(videoProgress.userId, user.id), eq(videoProgress.watched, true)));

  // Hitung ujian yang sudah dikumpulkan pengguna ini
  const mySubmissions = await db
    .select({ id: quizSubmissions.id })
    .from(quizSubmissions)
    .where(
      and(eq(quizSubmissions.userId, user.id), eq(quizSubmissions.status, "submitted"))
    );

  return (
    <>
      <PageHeader
        title={`Halo, ${user.name}`}
        description="Lanjutkan perjalanan belajarmu hari ini."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Materi Tersedia", value: approved.length, icon: "📚" },
          { label: "Video Ditonton", value: watchedVideos.length, icon: "🎥" },
          { label: "Ujian Dikerjakan", value: mySubmissions.length, icon: "📝" },
        ].map((stat) => (
          <div key={stat.label} className="card p-5">
            <div className="mb-2 text-2xl">{stat.icon}</div>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-sm text-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="card mt-6 p-6">
        <h2 className="mb-2 font-semibold">Mulai belajar</h2>
        <p className="text-sm text-muted">
          {approved.length > 0
            ? `Ada ${approved.length} materi siap dipelajari. `
            : "Belum ada materi tersedia. "}
          <Link href="/siswa/materi" className="text-accent hover:underline">
            Jelajahi materi
          </Link>
        </p>
        <p className="mt-2 text-sm text-muted">
          {mySubmissions.length === 0
            ? "Belum ada ujian yang dikerjakan. "
            : `${mySubmissions.length} ujian sudah kamu kerjakan. `}
          <Link href="/siswa/ujian" className="text-accent hover:underline">
            Lihat ujian
          </Link>
        </p>
      </div>

      <div className="card mt-4 p-6 bg-accent-soft border-accent/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🤖</span>
          <div>
            <h3 className="font-semibold text-foreground">Butuh Konsultasi Ide Usaha?</h3>
            <p className="text-xs text-muted">
              Tanyakan ide bisnis, riset pasar Samarinda, atau perizinan UMKM ke Miss Celine.
            </p>
          </div>
        </div>
        <Link
          href="/siswa/chat"
          className="btn-primary text-xs shrink-0 inline-flex items-center gap-1.5"
        >
          <span>💬</span> Tanya Miss Celine
        </Link>
      </div>
    </>
  );
}
