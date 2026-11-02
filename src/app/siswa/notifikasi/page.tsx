// Halaman Notifikasi Siswa

import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import { getUserNotifications } from "@/lib/support-queries";
import { NotificationList } from "@/components/shared/notification-list";

export const metadata = {
  title: "Notifikasi · Siswa",
  description: "Daftar notifikasi aktivitas dan pengumuman kursus.",
};

export default async function SiswaNotificationPage() {
  const user = await requireRole("siswa");
  const notifications = await getUserNotifications(user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pusat Notifikasi"
        description="Semua pemberitahuan seputar materi, hasil ujian, sertifikat, dan diskusi Anda."
      />

      <NotificationList initialNotifications={notifications} />
    </div>
  );
}
