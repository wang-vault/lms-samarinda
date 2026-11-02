"use client";

// Halaman daftar akun baru

import Link from "next/link";
import { useActionState } from "react";
import { registerAction, type ActionState } from "@/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { SubmitButton } from "@/components/auth/submit-button";

const initialState: ActionState = {};

export default function RegisterPage() {
  const [state, formAction] = useActionState(registerAction, initialState);

  return (
    <AuthShell
      title="Daftar Akun"
      subtitle="Bergabung dan mulai belajar membangun usaha."
      footer={
        <>
          Sudah punya akun?{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Masuk di sini
          </Link>
        </>
      }
    >
      <form action={formAction} className="space-y-4">
        {state.error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {state.error}
          </div>
        )}
        {state.success && (
          <div className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
            {state.success}
          </div>
        )}

        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
            Nama Lengkap
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            placeholder="Nama kamu"
            className="input-field"
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="nama@email.com"
            className="input-field"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            placeholder="Minimal 6 karakter"
            className="input-field"
          />
        </div>

        <div>
          <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium">
            Konfirmasi Password
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            placeholder="Ulangi password"
            className="input-field"
          />
        </div>

        <div>
          <label htmlFor="role" className="mb-1.5 block text-sm font-medium">
            Daftar sebagai
          </label>
          <select id="role" name="role" defaultValue="siswa" className="input-field">
            <option value="siswa">Siswa — ingin belajar</option>
            <option value="instruktur">Instruktur — ingin mengajar</option>
          </select>
          <p className="mt-1.5 text-xs text-muted">
            Akun admin hanya dapat dibuat oleh administrator.
          </p>
        </div>

        <SubmitButton>Buat Akun</SubmitButton>
      </form>
    </AuthShell>
  );
}
