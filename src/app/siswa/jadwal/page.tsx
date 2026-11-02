// Halaman Jadwal Belajar Siswa (Kalender / Target Belajar)

import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import { getUserStudySchedules, getForumCourses } from "@/lib/support-queries";
import { StudyScheduleManager } from "@/components/siswa/study-schedule-manager";

export const metadata = {
  title: "Jadwal Belajar · Siswa",
  description: "Atur kalender target waktu belajar dan ujian secara mandiri.",
};

export default async function SiswaJadwalPage() {
  const user = await requireRole("siswa");
  const schedules = await getUserStudySchedules(user.id);
  const courses = await getForumCourses();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jadwal & Kalender Belajar"
        description="Tetapkan target waktu belajar materi, menonton video, dan persiapan ujian secara disiplin."
      />

      <StudyScheduleManager
        schedules={schedules}
        courses={courses.map((c) => ({ id: c.id, title: c.title }))}
      />
    </div>
  );
}
