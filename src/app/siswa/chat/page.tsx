// Halaman Chatbot AI Siswa ("Tanya Bizzy")
// Area konsultasi ide bisnis pemula, perizinan, dan materi kursus di Samarinda

import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import { ChatInterface } from "@/components/siswa/chat-interface";

export const metadata = {
  title: "Tanya Bizzy · Chatbot AI",
  description:
    "Konsultasikan ide bisnis, strategi pemasaran lokal Samarinda, dan materi kursus bersama Bizzy.",
};

export default async function SiswaChatPage() {
  const user = await requireRole("siswa");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tanya Bizzy"
        description="Konsultasikan ide bisnis, strategi pemasaran lokal Samarinda, dan materi pembelajaran bersama asisten AI."
      />

      <ChatInterface userName={user.name ?? "Siswa"} />
    </div>
  );
}
