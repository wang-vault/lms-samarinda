// Halaman Thread Forum Diskusi per Kursus untuk Instruktur

import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { courses } from "@/db/schema";
import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import { getCourseForumThreads } from "@/lib/support-queries";
import { ForumThreadList } from "@/components/shared/forum-thread-list";
import Link from "next/link";

export default async function InstrukturCourseForumPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const user = await requireRole("instruktur");
  const { courseId } = await params;

  const [course] = await db
    .select({
      id: courses.id,
      title: courses.title,
      description: courses.description,
    })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  if (!course) {
    notFound();
  }

  const threads = await getCourseForumThreads(courseId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-muted">
        <Link href="/instruktur/forum" className="hover:text-accent">
          ← Kembali ke Forum Kursus
        </Link>
      </div>

      <PageHeader
        title={`Forum: ${course.title}`}
        description={course.description || "Bimbing diskusi dan jawab pertanyaan siswa di sini."}
      />

      <ForumThreadList
        courseId={course.id}
        currentUserId={user.id}
        currentUserRole={user.role}
        threads={threads}
      />
    </div>
  );
}
