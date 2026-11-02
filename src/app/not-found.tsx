// Halaman 404 Kustom (Tidak Ditemukan) — Bahasa Indonesia
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16 text-center bg-background text-foreground">
      <div className="card max-w-lg p-8 shadow-sm">
        <span className="mb-4 inline-block text-6xl">🧭</span>
        <h1 className="mb-2 text-3xl font-bold tracking-tight">404 - Halaman Tidak Ditemukan</h1>
        <p className="mb-6 text-sm text-muted">
          Halaman atau materi belajar yang Anda cari tidak tersedia, telah dipindahkan, atau tautan tidak valid.
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="btn-primary text-sm px-5 py-2.5 inline-block"
          >
            Kembali ke Beranda
          </Link>
          <Link
            href="/login"
            className="btn-secondary text-sm px-5 py-2.5 inline-block"
          >
            Masuk ke Akun
          </Link>
        </div>
      </div>
    </div>
  );
}
