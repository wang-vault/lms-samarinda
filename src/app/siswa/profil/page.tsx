// Halaman Profil Siswa

import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import { getUserProfile } from "@/lib/support-queries";
import { ProfileForm } from "@/components/shared/profile-form";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Profil Saya · Siswa",
  description: "Pengaturan profil dan akun siswa.",
};

export default async function SiswaProfilePage() {
  const user = await requireRole("siswa");
  const profile = await getUserProfile(user.id);

  if (!profile) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profil Pengguna"
        description="Kelola informasi identitas, rencana usaha, dan kata sandi akun Anda."
      />

      <ProfileForm user={profile} />
    </div>
  );
}
