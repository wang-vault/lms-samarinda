"use server";

// Server actions untuk register dan login

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users, USER_ROLES } from "@/db/schema";
import { dashboardPath } from "@/lib/auth-helpers";

export type ActionState = {
  error?: string;
  success?: string;
};

/** Daftar akun baru. Role hanya boleh instruktur atau siswa. */
export async function registerAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const roleRaw = String(formData.get("role") ?? "siswa");

  // Validasi
  if (!name || !email || !password) {
    return { error: "Semua field wajib diisi." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Format email tidak valid." };
  }
  if (password.length < 6) {
    return { error: "Password minimal 6 karakter." };
  }
  if (password !== confirm) {
    return { error: "Konfirmasi password tidak cocok." };
  }
  // Admin tidak bisa didaftarkan lewat form publik
  const role = roleRaw === "instruktur" ? "instruktur" : "siswa";
  if (!USER_ROLES.includes(role)) {
    return { error: "Role tidak valid." };
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    return { error: "Email sudah terdaftar." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(users).values({
    name,
    email,
    passwordHash,
    role,
  });

  // Langsung login setelah daftar
  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch {
    return {
      success: "Akun berhasil dibuat. Silakan masuk.",
    };
  }

  redirect(dashboardPath(role));
}

/** Login dengan email + password */
export async function loginAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email dan password wajib diisi." };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email atau password salah." };
    }
    throw error;
  }

  // Tentukan dashboard setelah login berhasil
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  redirect(user ? dashboardPath(user.role) : "/");
}

/** Logout */
export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
