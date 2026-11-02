// Halaman Profil Instruktur

import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import { getUserProfile } from "@/lib/support-queries";
import { ProfileForm } from "@/components/shared/profile-form";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Profil Saya · Instruktur",
  description: "Pengaturan profil dan akun instruktur.",
};

export default async function InstrukturProfilePage() {
  const user = await requireRole("instruktur");
  const profile = await getUserProfile(user.id);

  if (!profile) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profil Instruktur"
        description="Kelola informasi identitas pengajar dan kata sandi akun Anda."
      />

      <ProfileForm user={profile} />
    </div>
  );
}
