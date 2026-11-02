"use client";

// Daftar interaktif notifikasi pengguna dengan filter & aksi tandai dibaca

import { useState, useTransition } from "react";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/actions/support";
import type { NotificationItem } from "@/lib/support-queries";

export function NotificationList({
  initialNotifications,
}: {
  initialNotifications: NotificationItem[];
}) {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [isPending, startTransition] = useTransition();

  const handleMarkRead = (id: string) => {
    startTransition(async () => {
      await markNotificationReadAction(id);
    });
  };

  const handleMarkAllRead = () => {
    startTransition(async () => {
      await markAllNotificationsReadAction();
    });
  };

  const filtered =
    filter === "unread"
      ? initialNotifications.filter((n) => !n.read)
      : initialNotifications;

  const unreadCount = initialNotifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-4">
      {/* Bar Filter & Aksi */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === "all"
                ? "bg-accent text-white"
                : "border border-border bg-surface text-muted hover:text-foreground"
            }`}
          >
            Semua ({initialNotifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("unread")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === "unread"
                ? "bg-accent text-white"
                : "border border-border bg-surface text-muted hover:text-foreground"
            }`}
          >
            Belum Dibaca ({unreadCount})
          </button>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={isPending}
            className="text-xs text-accent hover:underline font-medium inline-flex items-center gap-1"
          >
            <span>✓✓</span> Tandai Semua Sudah Dibaca
          </button>
        )}
      </div>

      {/* Daftar Notifikasi */}
      {filtered.length === 0 ? (
        <div className="card p-8 text-center text-muted">
          <span className="text-3xl block mb-2">🔔</span>
          <p className="text-sm font-semibold text-foreground">
            {filter === "unread"
              ? "Tidak ada notifikasi yang belum dibaca."
              : "Belum ada notifikasi untuk Anda."}
          </p>
          <p className="text-xs mt-1">
            Aktivitas penting seperti verifikasi materi, kelulusan ujian, atau balasan forum akan tampil di sini.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`card p-4 transition-all flex items-start justify-between gap-3 ${
                !item.read
                  ? "border-accent/40 bg-accent-soft/30 shadow-sm"
                  : "opacity-80"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0 mt-0.5">
                  {item.type === "success"
                    ? "🏆"
                    : item.type === "warning"
                    ? "⚠️"
                    : "ℹ️"}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-foreground">
                      {item.title}
                    </h4>
                    {!item.read && (
                      <span className="inline-block h-2 w-2 rounded-full bg-accent" />
                    )}
                  </div>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    {item.message}
                  </p>
                  <p className="text-[11px] text-muted/70 mt-1.5">
                    {new Intl.DateTimeFormat("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(item.createdAt))}
                  </p>
                </div>
              </div>

              {!item.read && (
                <button
                  type="button"
                  onClick={() => handleMarkRead(item.id)}
                  disabled={isPending}
                  className="text-xs text-muted hover:text-accent font-medium shrink-0"
                  title="Tandai dibaca"
                >
                  Tandai Dibaca
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
