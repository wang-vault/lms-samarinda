"use client";

// Kerangka halaman dashboard: sidebar + header + konten
// Responsive: sidebar jadi drawer di mobile

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { logoutAction } from "@/actions/auth";
import type { UserRole } from "@/db/schema";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  /** true = menu belum tersedia (masih tahap berikutnya) */
  soon?: boolean;
};

export function DashboardShell({
  role,
  userName,
  navItems,
  children,
}: {
  role: UserRole;
  userName: string;
  navItems: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const roleLabel =
    role === "admin" ? "Admin" : role === "instruktur" ? "Instruktur" : "Siswa";

  const sidebar = (
    <nav className="flex h-full flex-col">
      <Link
        href={`/${role}`}
        className="flex items-center gap-2 px-4 py-5"
        onClick={() => setOpen(false)}
      >
        <span className="text-xl">🚀</span>
        <div>
          <p className="text-sm font-bold leading-tight">Mulai Usaha</p>
          <p className="text-[11px] text-muted">dari Nol · Samarinda</p>
        </div>
      </Link>

      <div className="flex-1 space-y-1 px-3 overflow-y-auto">
        {navItems.map((item) => {
          const active =
            item.href === `/${role}`
              ? pathname === item.href
              : pathname.startsWith(item.href);
          const common = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm";

          if (item.soon) {
            return (
              <span
                key={item.href}
                className={`${common} cursor-not-allowed text-muted/50`}
                title="Segera hadir"
              >
                <span className="text-base opacity-60">{item.icon}</span>
                {item.label}
                <span className="ml-auto rounded bg-border px-1.5 py-0.5 text-[10px] uppercase">
                  Soon
                </span>
              </span>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`${common} transition-colors ${
                active
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-muted hover:bg-accent-soft hover:text-foreground"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="border-t border-border p-3">
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
          >
            <span>🚪</span> Keluar
          </button>
        </form>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden w-60 shrink-0 border-r border-border bg-surface md:block">
        {sidebar}
      </aside>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-border bg-surface">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/80 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-lg border border-border px-2.5 py-1.5 text-sm md:hidden"
              aria-label="Buka menu"
            >
              ☰
            </button>
            <Link
              href={`/${role}/profil`}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              title="Lihat Profil"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
                {userName.charAt(0).toUpperCase()}
              </span>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium leading-tight">{userName}</p>
                <p className="text-xs text-muted">{roleLabel}</p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {/* Tautan Notifikasi Cepat di Header */}
            <Link
              href={`/${role}/notifikasi`}
              className="relative rounded-lg border border-border p-2 text-sm text-muted hover:border-accent hover:text-accent transition-colors"
              title="Pusat Notifikasi"
            >
              <span>🔔</span>
            </Link>

            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
