// Halaman Notifikasi Admin

import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import { getUserNotifications } from "@/lib/support-queries";
import { NotificationList } from "@/components/shared/notification-list";

export const metadata = {
  title: "Notifikasi · Admin",
  description: "Daftar notifikasi sistem dan materi baru yang butuh approval.",
};

export default async function AdminNotificationPage() {
  const user = await requireRole("admin");
  const notifications = await getUserNotifications(user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pusat Notifikasi Admin"
        description="Semua pemberitahuan sistem dan pengajuan materi yang menunggu persetujuan."
      />

      <NotificationList initialNotifications={notifications} />
    </div>
  );
}
