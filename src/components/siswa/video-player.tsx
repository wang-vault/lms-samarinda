"use client";

// Pemutar video dengan pencatatan progress otomatis.
// Setiap beberapa detik, posisi pemutar dikirim ke server action.

import { useRef, useState } from "react";
import { updateVideoProgressAction, markVideoWatchedAction } from "@/actions/videos";
import { CheckCircle2 } from "lucide-react";

/**
 * Pemutar video untuk siswa.
 * - Memutar video dari route /api/videos/[filename] (streaming Range)
 * - Mencatat detik yang sudah ditonton ke tabel video_progress
 * - Menandai video "selesai" saat progres >= 90%
 */
export function VideoPlayer({
  videoId,
  filePath,
  title,
  initialWatchedSeconds,
  initialWatched,
}: {
  videoId: string;
  filePath: string;
  title: string;
  initialWatchedSeconds: number;
  initialWatched: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Detik terakhir yang sudah dikirim ke server (mencegah pengiriman berulang)
  const lastReportedRef = useRef<number>(initialWatchedSeconds);
  const [progress, setProgress] = useState(initialWatchedSeconds);
  const [duration, setDuration] = useState(0);
  const [watched, setWatched] = useState(initialWatched);
  const [showResume, setShowResume] = useState(initialWatchedSeconds > 5);

  // Kirim posisi pemutar ke server
  async function report(current: number, total: number) {
    try {
      await updateVideoProgressAction(videoId, Math.floor(current), Math.floor(total));
    } catch {
      // Abaikan kegagalan jaringan — progress opsional bagi pengalaman
    }
  }

  // Pada muat awal: lanjutkan dari posisi terakhir (jika signifikan)
  function handleLoaded() {
    const el = videoRef.current;
    if (!el) return;
    if (initialWatchedSeconds > 5 && initialWatchedSeconds < el.duration - 5) {
      el.currentTime = initialWatchedSeconds;
    }
    setShowResume(false);
  }

  // Catat progress setiap kali posisi berubah (dibatasi agar tidak membanjiri server)
  function handleTimeUpdate() {
    const el = videoRef.current;
    if (!el) return;
    const current = el.currentTime;
    const total = el.duration || 0;
    if (!total) return;

    setProgress(current);

    // Hanya kirim setiap 5 detik (atau saat menonton ulang dari awal)
    if (current - lastReportedRef.current >= 5 || current < lastReportedRef.current) {
      lastReportedRef.current = current;
      void report(current, total);
    }

    // Tandai selesai di >= 90%
    if (!watched && current >= total * 0.9 && total > 0) {
      setWatched(true);
      void markVideoWatchedAction(videoId);
    }
  }

  // Saat video selesai diputar
  function handleEnded() {
    const el = videoRef.current;
    const total = el?.duration ?? 0;
    setWatched(true);
    void report(total || progress, total);
    void markVideoWatchedAction(videoId);
  }

  // Tombol "Tandai selesai" manual
  async function handleMarkWatched() {
    setWatched(true);
    await markVideoWatchedAction(videoId);
  }

  // Slider progres (0-100%)
  const percent = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg border border-border bg-black">
        <video
          ref={videoRef}
          src={`/api/videos/${filePath}`}
          title={title}
          controls
          playsInline
          className="aspect-video w-full bg-black"
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration || 0);
            handleLoaded();
          }}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
        >
          Browser kamu tidak mendukung pemutar video HTML5.
        </video>
        {showResume && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent p-3 text-xs text-white">
            <span>Lanjutkan dari posisi terakhir ({Math.floor(initialWatchedSeconds)} detik)</span>
            <button
              type="button"
              onClick={() => {
                const el = videoRef.current;
                if (el) el.currentTime = 0;
                setShowResume(false);
              }}
              className="rounded bg-white/20 px-2 py-1 hover:bg-white/30"
            >
              Mulai dari awal
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="h-1.5 min-w-[8rem] flex-1 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-xs text-muted">
          {watched ? (
            <span className="inline-flex items-center gap-1 font-medium text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Selesai ditonton</span>
            </span>
          ) : (
            `${Math.floor(percent)}% ditonton`
          )}
        </span>
        {!watched && (
          <button
            type="button"
            onClick={handleMarkWatched}
            className="btn-secondary px-3 py-1 text-xs"
          >
            Tandai selesai
          </button>
        )}
      </div>
    </div>
  );
}
