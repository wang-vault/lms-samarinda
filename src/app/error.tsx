"use client";

// Halaman Error Boundaries Global Next.js App Router (Bahasa Indonesia)
import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error di konsol untuk debugging
    console.error("Kesalahan aplikasi terdeteksi:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16 text-center bg-background text-foreground">
      <div className="card max-w-lg p-8 shadow-sm">
        <span className="mb-4 inline-block text-5xl">⚠️</span>
        <h1 className="mb-2 text-2xl font-bold tracking-tight">Terjadi Kesalahan Tak Terduga</h1>
        <p className="mb-6 text-sm text-muted">
          Maaf, sistem mengalami kendala teknis saat memproses permintaan Anda. Silakan coba muat ulang atau kembali ke halaman utama.
        </p>

        {error.digest && (
          <p className="mb-6 rounded bg-surface p-2 text-xs font-mono text-muted border border-border">
            Kode Diagnostik: {error.digest}
          </p>
        )}

        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="btn-primary text-sm px-5 py-2.5"
          >
            Coba Lagi
          </button>
          <Link
            href="/"
            className="btn-secondary text-sm px-5 py-2.5 inline-block"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
