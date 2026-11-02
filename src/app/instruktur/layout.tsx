// Layout area instruktur — wajib login sebagai instruktur
import { requireRole } from "@/lib/auth-helpers";
import { DashboardShell, type NavItem } from "@/components/layout/dashboard-shell";

const navItems: NavItem[] = [
  { href: "/instruktur", label: "Dashboard", icon: "🏠" },
  { href: "/instruktur/kursus", label: "Kursus Saya", icon: "📚" },
  { href: "/instruktur/materi", label: "Materi Saya", icon: "📄" },
  { href: "/instruktur/video", label: "Video", icon: "🎥" },
  { href: "/instruktur/quiz", label: "Quiz & Ujian", icon: "📝" },
  { href: "/instruktur/sertifikat", label: "Sertifikat", icon: "🏆" },
  { href: "/instruktur/forum", label: "Forum Diskusi", icon: "💬" },
  { href: "/instruktur/notifikasi", label: "Notifikasi", icon: "🔔" },
  { href: "/instruktur/profil", label: "Profil Saya", icon: "👤" },
];

export default async function InstrukturLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("instruktur");

  return (
    <DashboardShell
      role="instruktur"
      userName={user.name ?? "Instruktur"}
      navItems={navItems}
    >
      {children}
    </DashboardShell>
  );
}
