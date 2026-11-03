// Halaman Chatbot AI Siswa ("Tanya Litani")
// Area konsultasi ide bisnis pemula, perizinan, dan materi kursus di Samarinda

import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import { ChatInterface } from "@/components/siswa/chat-interface";

export const metadata = {
  title: "Tanya Litani · Chatbot AI",
  description:
    "Konsultasikan ide bisnis, strategi pemasaran lokal Samarinda, dan materi kursus bersama Litani.",
};

export default async function SiswaChatPage() {
  const user = await requireRole("siswa");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tanya Litani"
        description="Konsultasikan ide bisnis, strategi pemasaran lokal Samarinda, dan materi pembelajaran bersama asisten AI."
      />

      <ChatInterface userName={user.name ?? "Siswa"} />
    </div>
  );
}
