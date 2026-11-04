// Halaman landing LMS "Mulai Usaha dari Nol di Samarinda"
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  Rocket,
  Sparkles,
  BookOpen,
  Video,
  ClipboardList,
  Bot,
  MessageSquare,
  Trophy,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header Navigasi */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2">
            <Rocket className="h-6 w-6 text-accent shrink-0" aria-hidden="true" />
            <div>
              <h1 className="text-base font-bold leading-tight">
                Mulai Usaha dari Nol
              </h1>
              <p className="text-[11px] text-muted">Samarinda Entrepreneurship LMS</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className="btn-secondary text-sm px-3.5 py-1.5"
            >
              Masuk
            </Link>
            <Link
              href="/register"
              className="btn-primary text-sm px-3.5 py-1.5"
            >
              Daftar Gratis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 sm:py-24 text-center">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-4 py-1.5 text-xs font-semibold text-accent">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>Platform Pembelajaran Wirausaha Samarinda Terpadu</span>
          </div>

          <h2 className="mb-5 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Bangun Bisnis Impianmu
            <br />
            <span className="text-accent">dari Nol di Kota Samarinda</span>
          </h2>

          <p className="mb-8 text-base text-muted sm:text-lg max-w-2xl mx-auto">
            Pelajari riset pasar lokal di Citra Niaga & Tepian Mahakam, legalitas NIB & OSS, video materi terarah, ujian interaktif, hingga konsultasi pintar bersama Bizzy AI.
          </p>

          <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
            <Link href="/register" className="btn-primary px-7 py-3 text-base shadow-sm">
              Mulai Belajar Sekarang →
            </Link>
            <Link href="/login" className="btn-secondary px-6 py-3 text-base">
              Masuk ke Kelas
            </Link>
          </div>

          {/* Profil Akun Demo Cepat */}
          <div className="mt-8 rounded-lg border border-border bg-surface p-3 text-xs text-muted max-w-md mx-auto">
            <p className="font-semibold text-foreground mb-1">Akun Akses Uji Coba (Demo):</p>
            <div className="flex justify-around text-left">
              <div>
                <p className="text-[11px] font-medium text-foreground">Siswa:</p>
                <p>siswa@lms.com</p>
                <p className="text-muted/70">siswa123</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-foreground">Instruktur:</p>
                <p>instruktur@lms.com</p>
                <p className="text-muted/70">instruktur123</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-foreground">Admin:</p>
                <p>admin@lms.com</p>
                <p className="text-muted/70">admin123</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Fitur Utama */}
      <section className="border-t border-border bg-surface/50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold tracking-tight">Semua yang Anda Butuhkan untuk Sukses</h3>
            <p className="text-sm text-muted mt-2">Didesain khusus untuk karakter pasar dan ekosistem bisnis di Kalimantan Timur</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: <BookOpen className="h-6 w-6" aria-hidden="true" />,
                title: "Materi Kurikulum Lokal",
                desc: "Panduan PDF dan modul bacaan bisnis kuliner, jasa, hingga perizinan legalitas UMKM Kota Samarinda.",
              },
              {
                icon: <Video className="h-6 w-6" aria-hidden="true" />,
                title: "Video Streaming Terarah",
                desc: "Pemutar video native dengan pelacakan progres belajar otomatis (HTTP Range video streaming).",
              },
              {
                icon: <ClipboardList className="h-6 w-6" aria-hidden="true" />,
                title: "Ujian & Sertifikasi Resmi",
                desc: "Ujian pilihan ganda & essay berwaktu, penilaian otomatis, dan sertifikat ber-ID verifikasi PDF resmi.",
              },
              {
                icon: <Bot className="h-6 w-6" aria-hidden="true" />,
                title: "Konsultan AI 'Bizzy'",
                desc: "Asisten AI streaming ramah yang paham seluk-beluk tren konsumen dan perizinan usaha di Samarinda.",
              },
              {
                icon: <MessageSquare className="h-6 w-6" aria-hidden="true" />,
                title: "Forum Diskusi & Komunitas",
                desc: "Wadah tanya-jawab interaktif antar siswa dan instruktur dengan notifikasi in-app instan.",
              },
              {
                icon: <Trophy className="h-6 w-6" aria-hidden="true" />,
                title: "Jadwal Belajar & Leaderboard",
                desc: "Atur target belajar mandiri dan raih poin gamifikasi berdasarkan kelulusan ujian dan materi.",
              },
            ].map((f) => (
              <div key={f.title} className="card p-6 transition-all hover:border-accent/40 hover:shadow-sm">
                <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  {f.icon}
                </div>
                <h4 className="mb-2 text-base font-semibold">{f.title}</h4>
                <p className="text-sm text-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-accent shrink-0" aria-hidden="true" />
            <p className="text-xs text-muted">
              © 2026 <strong>Mulai Usaha dari Nol di Samarinda</strong>. Seluruh hak cipta dilindungi.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted">
            <span>Dibuat dengan Next.js App Router, SQLite, dan Drizzle ORM</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
