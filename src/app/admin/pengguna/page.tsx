// Halaman Manajemen Pengguna Admin (Tahap 8)

import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import { db } from "@/db";
import { users } from "@/db/schema";
import { desc } from "drizzle-orm";

export const metadata = {
  title: "Kelola Pengguna · Admin",
  description: "Daftar seluruh pengguna terdaftar dalam sistem LMS.",
};

export default async function AdminPenggunaPage() {
  await requireRole("admin");

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      bio: users.bio,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kelola Pengguna"
        description="Daftar seluruh akun terdaftar (Administrator, Instruktur, dan Siswa) di platform."
      />

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/10 text-xs font-semibold text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3 text-center">Role</th>
                <th className="px-4 py-3">Bio</th>
                <th className="px-4 py-3 text-right">Terdaftar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allUsers.map((u) => (
                <tr key={u.id} className="hover:bg-muted/5 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                        {u.name.charAt(0).toUpperCase()}
                      </span>
                      <span>{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{u.email}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                        u.role === "admin"
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
                          : u.role === "instruktur"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                          : "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted max-w-xs truncate">
                    {u.bio || "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted">
                    {new Intl.DateTimeFormat("id-ID", {
                      dateStyle: "medium",
                    }).format(new Date(u.createdAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
