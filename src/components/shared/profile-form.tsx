"use client";

// Form Pengaturan Profil Pengguna & Kata Sandi

import { useState, useTransition } from "react";
import { updateProfileAction } from "@/actions/support";

export function ProfileForm({
  user,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    bio: string | null;
    createdAt: Date;
  };
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const res = await updateProfileAction(null, formData);
      if (!res.ok) {
        setError(res.error || "Gagal memperbarui profil.");
      } else {
        setSuccess(res.successMessage || "Profil berhasil diperbarui!");
        // Bersihkan field password setelah ganti password berhasil
        const curPassInput = form.querySelector(
          'input[name="currentPassword"]'
        ) as HTMLInputElement;
        const newPassInput = form.querySelector(
          'input[name="newPassword"]'
        ) as HTMLInputElement;
        if (curPassInput) curPassInput.value = "";
        if (newPassInput) newPassInput.value = "";
      }
    });
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Kartu Informasi Akun */}
      <div className="card p-5 flex items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-2xl font-bold text-white shadow-sm">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-foreground">{user.name}</h2>
            <span className="rounded bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent capitalize">
              {user.role}
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">{user.email}</p>
          <p className="text-[11px] text-muted/70 mt-1">
            Bergabung sejak{" "}
            {new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(
              new Date(user.createdAt)
            )}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-300">
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-50 p-3 text-xs text-green-700 dark:bg-green-950/40 dark:text-green-300">
          ✓ {success}
        </div>
      )}

      {/* Formulir Update Profil */}
      <form onSubmit={handleSubmit} className="card p-5 space-y-4">
        <h3 className="text-sm font-bold text-foreground border-b border-border pb-2">
          Informasi Dasar
        </h3>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Nama Lengkap *
          </label>
          <input
            type="text"
            name="name"
            required
            defaultValue={user.name}
            className="input-field text-sm"
            disabled={isPending}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Alamat Email
          </label>
          <input
            type="email"
            value={user.email}
            disabled
            className="input-field text-sm opacity-60 cursor-not-allowed bg-muted/10"
            title="Email tidak dapat diubah"
          />
          <p className="text-[11px] text-muted mt-1">
            Email digunakan sebagai pengenal akun dan login.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Bio / Profil Usaha
          </label>
          <textarea
            name="bio"
            rows={3}
            defaultValue={user.bio || ""}
            placeholder="Ceritakan tentang rencana usaha, minat bisnis, atau pengalamanmu di Samarinda..."
            className="input-field text-sm leading-relaxed"
            disabled={isPending}
          />
        </div>

        <h3 className="text-sm font-bold text-foreground border-b border-border pb-2 pt-3">
          Ganti Kata Sandi (Opsional)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Kata Sandi Saat Ini
            </label>
            <input
              type="password"
              name="currentPassword"
              placeholder="••••••••"
              className="input-field text-sm"
              disabled={isPending}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Kata Sandi Baru (Min. 6 Karakter)
            </label>
            <input
              type="password"
              name="newPassword"
              placeholder="••••••••"
              className="input-field text-sm"
              disabled={isPending}
            />
          </div>
        </div>

        <div className="flex justify-end pt-3">
          <button
            type="submit"
            disabled={isPending}
            className="btn-primary text-xs"
          >
            {isPending ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </form>
    </div>
  );
}
