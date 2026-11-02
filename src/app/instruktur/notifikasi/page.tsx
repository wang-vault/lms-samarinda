// Halaman Notifikasi Instruktur

import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import { getUserNotifications } from "@/lib/support-queries";
import { NotificationList } from "@/components/shared/notification-list";

export const metadata = {
  title: "Notifikasi · Instruktur",
  description: "Daftar notifikasi terkait materi dan aktivitas siswa.",
};

export default async function InstrukturNotificationPage() {
  const user = await requireRole("instruktur");
  const notifications = await getUserNotifications(user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pusat Notifikasi"
        description="Semua pemberitahuan verifikasi materi dan aktivitas diskusi siswa di kursus Anda."
      />

      <NotificationList initialNotifications={notifications} />
    </div>
  );
}
