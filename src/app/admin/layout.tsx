// Layout area admin — wajib login sebagai admin
import { requireRole } from "@/lib/auth-helpers";
import { DashboardShell, type NavItem } from "@/components/layout/dashboard-shell";

const navItems: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "🏠" },
  { href: "/admin/materi", label: "Approval Materi", icon: "✅" },
  { href: "/admin/pengguna", label: "Pengguna", icon: "👥" },
  { href: "/admin/notifikasi", label: "Notifikasi", icon: "🔔" },
  { href: "/admin/profil", label: "Profil Saya", icon: "👤" },
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
