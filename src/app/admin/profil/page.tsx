// Halaman Profil Admin

import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import { getUserProfile } from "@/lib/support-queries";
import { ProfileForm } from "@/components/shared/profile-form";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Profil Saya · Admin",
  description: "Pengaturan akun administrator sistem LMS.",
};

export default async function AdminProfilePage() {
  const user = await requireRole("admin");
  const profile = await getUserProfile(user.id);

  if (!profile) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profil Administrator"
        description="Kelola informasi identitas administrator sistem dan kata sandi."
      />

      <ProfileForm user={profile} />
    </div>
  );
}
