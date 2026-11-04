// Dashboard admin
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { materials, users, courses } from "@/db/schema";
import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import { Users, BookOpen, Clock, CircleCheck } from "lucide-react";

export default async function AdminDashboardPage() {
  const user = await requireRole("admin");

  const [totalUsers, totalCourses, pendingMaterials, approvedMaterials] =
    await Promise.all([
      db.select({ id: users.id }).from(users),
      db.select({ id: courses.id }).from(courses),
      db
        .select({ id: materials.id })
        .from(materials)
        .where(eq(materials.status, "pending")),
      db
        .select({ id: materials.id })
        .from(materials)
        .where(eq(materials.status, "approved")),
    ]);

  const pendingCount = pendingMaterials.length;

  return (
    <>
      <PageHeader
        title={`Halo, ${user.name}`}
        description="Ringkasan platform dan tugas yang menunggu."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total Pengguna",
            value: totalUsers.length,
            icon: <Users className="h-5 w-5" aria-hidden="true" />,
          },
          {
            label: "Total Kursus",
            value: totalCourses.length,
            icon: <BookOpen className="h-5 w-5" aria-hidden="true" />,
          },
          {
            label: "Materi Menunggu",
            value: pendingCount,
            icon: <Clock className="h-5 w-5" aria-hidden="true" />,
          },
          {
            label: "Materi Disetujui",
            value: approvedMaterials.length,
            icon: <CircleCheck className="h-5 w-5" aria-hidden="true" />,
          },
        ].map((stat) => (
          <div key={stat.label} className="card p-5">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
              {stat.icon}
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-sm text-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="card mt-6 p-6">
        <h2 className="mb-2 font-semibold">Tugas Menunggu</h2>
        {pendingCount > 0 ? (
          <p className="text-sm text-muted">
            Ada{" "}
            <Link
              href="/admin/materi"
              className="font-medium text-accent hover:underline"
            >
              {pendingCount} materi menunggu persetujuan
            </Link>
            .
          </p>
        ) : (
          <p className="text-sm text-muted">
            Tidak ada materi yang menunggu.{" "}
            <Link
              href="/admin/materi"
              className="text-accent hover:underline"
            >
              Lihat semua materi
            </Link>
          </p>
        )}
      </div>
    </>
  );
}
