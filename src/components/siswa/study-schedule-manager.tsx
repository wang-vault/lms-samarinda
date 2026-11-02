"use client";

// Kalender & Pengelola Jadwal Belajar Siswa

import { useState, useTransition } from "react";
import {
  createStudyScheduleAction,
  deleteStudyScheduleAction,
} from "@/actions/support";
import type { ScheduleItem } from "@/lib/support-queries";

export function StudyScheduleManager({
  schedules,
  courses,
}: {
  schedules: ScheduleItem[];
  courses: Array<{ id: string; title: string }>;
}) {
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Ambil tanggal hari ini dalam format YYYY-MM-DD
  const todayStr = new Date().toISOString().split("T")[0];

  const handleAddSchedule = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setActionError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const res = await createStudyScheduleAction(null, formData);
      if (!res.ok) {
        setActionError(res.error || "Gagal menyimpan jadwal belajar.");
      } else {
        form.reset();
        setShowAddForm(false);
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Hapus agenda belajar ini?")) return;
    startTransition(async () => {
      const res = await deleteStudyScheduleAction(id);
      if (!res.ok) {
        setActionError(res.error || "Gagal menghapus jadwal.");
      }
    });
  };

  // Pisahkan jadwal mendatang vs yang sudah lewat
  const upcoming = schedules.filter((s) => s.scheduledDate >= todayStr);
  const past = schedules.filter((s) => s.scheduledDate < todayStr);

  return (
    <div className="space-y-6">
      {/* Tombol Tambah Jadwal */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">
            Target & Rencana Belajar
          </h3>
          <p className="text-xs text-muted">
            Atur pengingat tanggal belajar agar konsisten menyelesaikan materi dan ujian.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-primary text-xs inline-flex items-center gap-1.5"
        >
          <span>{showAddForm ? "✕" : "+"}</span>
          <span>{showAddForm ? "Tutup Form" : "Tambah Jadwal"}</span>
        </button>
      </div>

      {actionError && (
        <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-300">
          ⚠️ {actionError}
        </div>
      )}

      {/* Form Tambah Jadwal */}
      {showAddForm && (
        <div className="card p-4 sm:p-5 border-accent/40 bg-accent-soft/20">
          <h4 className="text-sm font-bold text-foreground mb-3">
            Jadwalkan Waktu Belajar Baru
          </h4>
          <form onSubmit={handleAddSchedule} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Judul Rencana Belajar *
              </label>
              <input
                type="text"
                name="title"
                required
                placeholder="Misal: Tonton Video Modul 2 & Latihan Soal"
                className="input-field text-sm"
                disabled={isPending}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Tanggal Target *
                </label>
                <input
                  type="date"
                  name="scheduledDate"
                  required
                  defaultValue={todayStr}
                  min={todayStr}
                  className="input-field text-sm"
                  disabled={isPending}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Terkait Kursus (Opsional)
                </label>
                <select
                  name="courseId"
                  className="input-field text-sm"
                  disabled={isPending}
                >
                  <option value="">-- Pilih Kursus (Opsional) --</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="btn-secondary text-xs"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="btn-primary text-xs"
              >
                {isPending ? "Menyimpan..." : "Simpan Jadwal"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Daftar Jadwal Mendatang */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
          Mendatang & Hari Ini ({upcoming.length})
        </h4>

        {upcoming.length === 0 ? (
          <div className="card p-6 text-center text-muted">
            <span className="text-2xl block mb-1">📅</span>
            <p className="text-sm font-semibold text-foreground">
              Belum ada jadwal belajar mendatang.
            </p>
            <p className="text-xs mt-0.5">
              Klik &ldquo;Tambah Jadwal&rdquo; di atas untuk menetapkan target belajarmu minggu ini.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {upcoming.map((item) => {
              const isToday = item.scheduledDate === todayStr;
              return (
                <div
                  key={item.id}
                  className={`card p-4 flex items-start justify-between gap-3 ${
                    isToday ? "border-accent bg-accent-soft/30 shadow-sm" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0 mt-0.5">
                      {isToday ? "🎯" : "📌"}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-foreground">
                          {item.title}
                        </p>
                        {isToday && (
                          <span className="rounded bg-accent px-1.5 py-0.2 text-[10px] font-bold text-white uppercase">
                            Hari Ini
                          </span>
                        )}
                      </div>
                      {item.courseTitle && (
                        <p className="text-xs text-accent font-medium mt-0.5">
                          📚 {item.courseTitle}
                        </p>
                      )}
                      <p className="text-[11px] text-muted mt-1">
                        🗓️ {item.scheduledDate}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    disabled={isPending}
                    className="text-muted hover:text-red-500 text-xs p-1"
                    title="Hapus jadwal"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Daftar Jadwal yang Sudah Lewat */}
      {past.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-border">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
            Riwayat Sesi Sebelumnya ({past.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 opacity-70">
            {past.map((item) => (
              <div
                key={item.id}
                className="card p-3 flex items-center justify-between gap-2"
              >
                <div>
                  <p className="text-xs font-medium text-foreground line-through">
                    {item.title}
                  </p>
                  <p className="text-[10px] text-muted">
                    🗓️ {item.scheduledDate} {item.courseTitle ? `· ${item.courseTitle}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  disabled={isPending}
                  className="text-muted hover:text-red-500 text-[11px]"
                  title="Hapus"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
