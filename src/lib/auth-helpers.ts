// Helper untuk mengecek sesi dan role di server

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { UserRole } from "@/db/schema";

/**
 * Ambil sesi user yang sedang login.
 * Redirect ke /login jika belum login.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session.user;
}

/**
 * Pastikan user punya role tertentu.
 * Redirect ke dashboard miliknya jika role tidak sesuai.
 */
export async function requireRole(role: UserRole | UserRole[]) {
  const user = await requireAuth();
  const allowed = Array.isArray(role) ? role : [role];

  if (!allowed.includes(user.role)) {
    redirect(dashboardPath(user.role));
  }
  return user;
}

/** Path dashboard sesuai role */
export function dashboardPath(role: UserRole): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "instruktur":
      return "/instruktur";
    case "siswa":
      return "/siswa";
    default:
      return "/";
  }
}
