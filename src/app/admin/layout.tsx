// Layout area admin — wajib login sebagai admin
import { requireRole } from "@/lib/auth-helpers";
import { DashboardShell, type NavItem } from "@/components/layout/dashboard-shell";
import {
  LayoutDashboard,
  ClipboardCheck,
  Users,
  Bell,
  User,
} from "lucide-react";

const navItems: NavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: <LayoutDashboard className="h-5 w-5" aria-hidden="true" />,
  },
  {
    href: "/admin/materi",
    label: "Approval Materi",
    icon: <ClipboardCheck className="h-5 w-5" aria-hidden="true" />,
  },
  {
    href: "/admin/pengguna",
    label: "Pengguna",
    icon: <Users className="h-5 w-5" aria-hidden="true" />,
  },
  {
    href: "/admin/notifikasi",
    label: "Notifikasi",
    icon: <Bell className="h-5 w-5" aria-hidden="true" />,
  },
  {
    href: "/admin/profil",
    label: "Profil Saya",
    icon: <User className="h-5 w-5" aria-hidden="true" />,
  },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("admin");

  return (
    <DashboardShell role="admin" userName={user.name ?? "Admin"} navItems={navItems}>
      {children}
    </DashboardShell>
  );
}
