"use client";

// Halaman masuk

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type ActionState } from "@/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { SubmitButton } from "@/components/auth/submit-button";

const initialState: ActionState = {};

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <AuthShell
      title="Masuk"
      subtitle="Lanjutkan perjalanan belajar kewirausahaanmu."
      footer={
        <>
          Belum punya akun?{" "}
          <Link href="/register" className="font-medium text-accent hover:underline">
            Daftar sekarang
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
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="input-field"
          />
        </div>

        <SubmitButton>Masuk</SubmitButton>
      </form>

      <div className="mt-6 rounded-lg bg-accent-soft p-3 text-xs text-muted">
        <p className="mb-1 font-semibold text-foreground">Akun demo:</p>
        <p>admin@lms.com / admin123</p>
        <p>instruktur@lms.com / instruktur123</p>
        <p>siswa@lms.com / siswa123</p>
      </div>
    </AuthShell>
  );
}
