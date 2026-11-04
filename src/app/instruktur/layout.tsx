// Layout area instruktur — wajib login sebagai instruktur
import { requireRole } from "@/lib/auth-helpers";
import { DashboardShell, type NavItem } from "@/components/layout/dashboard-shell";
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Video,
  ClipboardList,
  Award,
  MessageSquare,
  Bell,
  User,
} from "lucide-react";

const navItems: NavItem[] = [
  {
    href: "/instruktur",
    label: "Dashboard",
    icon: <LayoutDashboard className="h-5 w-5" aria-hidden="true" />,
  },
  {
    href: "/instruktur/kursus",
    label: "Kursus Saya",
    icon: <BookOpen className="h-5 w-5" aria-hidden="true" />,
  },
  {
    href: "/instruktur/materi",
    label: "Materi Saya",
    icon: <FileText className="h-5 w-5" aria-hidden="true" />,
  },
  {
    href: "/instruktur/video",
    label: "Video",
    icon: <Video className="h-5 w-5" aria-hidden="true" />,
  },
  {
    href: "/instruktur/quiz",
    label: "Quiz & Ujian",
    icon: <ClipboardList className="h-5 w-5" aria-hidden="true" />,
  },
  {
    href: "/instruktur/sertifikat",
    label: "Sertifikat",
    icon: <Award className="h-5 w-5" aria-hidden="true" />,
  },
  {
    href: "/instruktur/forum",
    label: "Forum Diskusi",
    icon: <MessageSquare className="h-5 w-5" aria-hidden="true" />,
  },
  {
    href: "/instruktur/notifikasi",
    label: "Notifikasi",
    icon: <Bell className="h-5 w-5" aria-hidden="true" />,
  },
  {
    href: "/instruktur/profil",
    label: "Profil Saya",
    icon: <User className="h-5 w-5" aria-hidden="true" />,
  },
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
