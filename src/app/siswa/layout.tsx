// Layout area siswa — wajib login sebagai siswa
import { requireRole } from "@/lib/auth-helpers";
import { DashboardShell, type NavItem } from "@/components/layout/dashboard-shell";

const navItems: NavItem[] = [
  { href: "/siswa", label: "Dashboard", icon: "🏠" },
  { href: "/siswa/materi", label: "Materi", icon: "📚" },
  { href: "/siswa/video", label: "Video", icon: "🎥" },
  { href: "/siswa/ujian", label: "Ujian", icon: "📝" },
  { href: "/siswa/sertifikat", label: "Sertifikat", icon: "🏆" },
  { href: "/siswa/chat", label: "Tanya AI", icon: "🤖" },
  { href: "/siswa/forum", label: "Forum Diskusi", icon: "💬" },
  { href: "/siswa/jadwal", label: "Jadwal Belajar", icon: "📅" },
  { href: "/siswa/leaderboard", label: "Peringkat", icon: "🏅" },
  { href: "/siswa/notifikasi", label: "Notifikasi", icon: "🔔" },
  { href: "/siswa/profil", label: "Profil Saya", icon: "👤" },
];

export default async function SiswaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("siswa");

  return (
    <DashboardShell
      role="siswa"
      userName={user.name ?? "Siswa"}
      navItems={navItems}
    >
      {children}
    </DashboardShell>
  );
}
