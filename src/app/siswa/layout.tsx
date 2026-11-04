// Layout area siswa — wajib login sebagai siswa
import { requireRole } from "@/lib/auth-helpers";
import { DashboardShell, type NavItem } from "@/components/layout/dashboard-shell";
import {
  LayoutDashboard,
  BookOpen,
  Video,
  ClipboardList,
  Award,
  Bot,
  MessageSquare,
  Calendar,
  Trophy,
  Bell,
  User,
} from "lucide-react";

const navItems: NavItem[] = [
  {
    href: "/siswa",
    label: "Dashboard",
    icon: <LayoutDashboard className="h-5 w-5" aria-hidden="true" />,
  },
  {
    href: "/siswa/materi",
    label: "Materi",
    icon: <BookOpen className="h-5 w-5" aria-hidden="true" />,
  },
  {
    href: "/siswa/video",
    label: "Video",
    icon: <Video className="h-5 w-5" aria-hidden="true" />,
  },
  {
    href: "/siswa/ujian",
    label: "Ujian",
    icon: <ClipboardList className="h-5 w-5" aria-hidden="true" />,
  },
  {
    href: "/siswa/sertifikat",
    label: "Sertifikat",
    icon: <Award className="h-5 w-5" aria-hidden="true" />,
  },
  {
    href: "/siswa/chat",
    label: "Tanya AI",
    icon: <Bot className="h-5 w-5" aria-hidden="true" />,
  },
  {
    href: "/siswa/forum",
    label: "Forum Diskusi",
    icon: <MessageSquare className="h-5 w-5" aria-hidden="true" />,
  },
  {
    href: "/siswa/jadwal",
    label: "Jadwal Belajar",
    icon: <Calendar className="h-5 w-5" aria-hidden="true" />,
  },
  {
    href: "/siswa/leaderboard",
    label: "Peringkat",
    icon: <Trophy className="h-5 w-5" aria-hidden="true" />,
  },
  {
    href: "/siswa/notifikasi",
    label: "Notifikasi",
    icon: <Bell className="h-5 w-5" aria-hidden="true" />,
  },
  {
    href: "/siswa/profil",
    label: "Profil Saya",
    icon: <User className="h-5 w-5" aria-hidden="true" />,
  },
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
