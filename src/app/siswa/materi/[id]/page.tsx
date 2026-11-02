// Halaman detail materi untuk siswa
// Menampilkan teks, atau viewer PDF yang sudah approved

import { notFound } from "next/navigation";
import Link from "next/link";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { materials, courses, users } from "@/db/schema";
import { requireRole } from "@/lib/auth-helpers";

export default async function SiswaMaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("siswa");
  const { id } = await params;

  const [m] = await db
    .select({
      id: materials.id,
      title: materials.title,
      type: materials.type,
      content: materials.content,
      filePath: materials.filePath,
      status: materials.status,
      createdAt: materials.createdAt,
      courseTitle: courses.title,
      creatorName: users.name,
    })
    .from(materials)
    .leftJoin(courses, eq(materials.courseId, courses.id))
    .leftJoin(users, eq(materials.createdBy, users.id))
    .where(and(eq(materials.id, id), eq(materials.status, "approved")))
    .limit(1);

  if (!m) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/siswa/materi"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        ← Kembali ke daftar materi
      </Link>

      <div className="card p-6 sm:p-8">
        <p className="mb-2 text-xs text-muted">
          {m.courseTitle} · oleh {m.creatorName}
        </p>
        <h1 className="mb-4 text-2xl font-bold tracking-tight">{m.title}</h1>

        {m.type === "pdf" ? (
          <div>
            <object
              data={`/api/materials/pdf/${m.filePath}`}
              type="application/pdf"
              className="h-[70vh] w-full rounded-lg border border-border"
            >
              <p className="p-4 text-sm text-muted">
                Browser tidak mendukung viewer PDF bawaan.{" "}
                <a
                  href={`/api/materials/pdf/${m.filePath}`}
                  className="text-accent hover:underline"
                >
                  Unduh PDF
                </a>
              </p>
            </object>
          </div>
        ) : (
          <article className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground">
            {m.content}
          </article>
        )}
      </div>
    </div>
  );
}
