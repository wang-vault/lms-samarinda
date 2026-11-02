// Server actions untuk Fitur Pendukung (Tahap 8):
// Forum diskusi, Notifikasi, Jadwal Belajar, & Profil

"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  forumPosts,
  notifications,
  studySchedules,
  users,
  courses,
} from "@/db/schema";
import { requireAuth } from "@/lib/auth-helpers";

// ============================================
// 1. FORUM DISKUSI
// ============================================

/**
 * Buat post baru di forum kursus (topik utama atau balasan).
 */
export async function createForumPostAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireAuth();

    const courseId = formData.get("courseId")?.toString().trim();
    const content = formData.get("content")?.toString().trim();
    const parentIdRaw = formData.get("parentId")?.toString().trim();
    const parentId = parentIdRaw && parentIdRaw.length > 0 ? parentIdRaw : null;

    if (!courseId) {
      return { ok: false, error: "Kursus harus dipilih." };
    }
    if (!content || content.length < 3) {
      return { ok: false, error: "Isi diskusi minimal 3 karakter." };
    }

    // Pastikan kursus ada
    const [course] = await db
      .select({ id: courses.id, title: courses.title, instructorId: courses.instructorId })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) {
      return { ok: false, error: "Kursus tidak ditemukan." };
    }

    // Jika balasan, pastikan parentPost ada di kursus yang sama
    let parentPostOwnerId: string | null = null;
    if (parentId) {
      const [parent] = await db
        .select({ id: forumPosts.id, userId: forumPosts.userId, courseId: forumPosts.courseId })
        .from(forumPosts)
        .where(and(eq(forumPosts.id, parentId), eq(forumPosts.courseId, courseId)))
        .limit(1);

      if (!parent) {
        return { ok: false, error: "Topik yang ingin dibalas tidak ditemukan." };
      }
      parentPostOwnerId = parent.userId;
    }

    // Simpan post
    await db.insert(forumPosts).values({
      courseId,
      userId: user.id,
      parentId,
      content,
    });

    // Kirim notifikasi jika ini adalah balasan ke post orang lain
    if (parentPostOwnerId && parentPostOwnerId !== user.id) {
      await db.insert(notifications).values({
        userId: parentPostOwnerId,
        title: "Balasan baru di forum",
        message: `${user.name || "Seseorang"} membalas diskusimu di kursus "${course.title}".`,
        type: "info",
      });
    }

    revalidatePath(`/siswa/forum/${courseId}`);
    revalidatePath(`/instruktur/forum/${courseId}`);
    revalidatePath("/siswa/forum");
    revalidatePath("/instruktur/forum");

    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mengirim diskusi.";
    return { ok: false, error: message };
  }
}

/**
 * Hapus post forum (hanya pembuat post atau admin yang diizinkan).
 */
export async function deleteForumPostAction(
  postId: string,
  courseId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireAuth();

    const [post] = await db
      .select({ id: forumPosts.id, userId: forumPosts.userId })
      .from(forumPosts)
      .where(eq(forumPosts.id, postId))
      .limit(1);

    if (!post) {
      return { ok: false, error: "Diskusi tidak ditemukan." };
    }

    if (post.userId !== user.id && user.role !== "admin") {
      return { ok: false, error: "Anda tidak berhak menghapus diskusi ini." };
    }

    // Hapus balasan di bawahnya jika ada (cascade manual)
    await db.delete(forumPosts).where(eq(forumPosts.parentId, postId));
    // Hapus post utama
    await db.delete(forumPosts).where(eq(forumPosts.id, postId));

    revalidatePath(`/siswa/forum/${courseId}`);
    revalidatePath(`/instruktur/forum/${courseId}`);
    revalidatePath("/siswa/forum");
    revalidatePath("/instruktur/forum");

    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menghapus diskusi.";
    return { ok: false, error: message };
  }
}

// ============================================
// 2. NOTIFIKASI
// ============================================

/**
 * Tandai satu notifikasi sebagai telah dibaca.
 */
export async function markNotificationReadAction(
  notificationId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireAuth();

    await db
      .update(notifications)
      .set({ read: true })
      .where(
        and(eq(notifications.id, notificationId), eq(notifications.userId, user.id))
      );

    revalidatePath("/siswa/notifikasi");
    revalidatePath("/instruktur/notifikasi");
    revalidatePath("/admin/notifikasi");

    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memperbarui notifikasi.";
    return { ok: false, error: message };
  }
}

/**
 * Tandai SEMUA notifikasi milik user yang login sebagai telah dibaca.
 */
export async function markAllNotificationsReadAction(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const user = await requireAuth();

    await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.userId, user.id));

    revalidatePath("/siswa/notifikasi");
    revalidatePath("/instruktur/notifikasi");
    revalidatePath("/admin/notifikasi");

    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memperbarui notifikasi.";
    return { ok: false, error: message };
  }
}

// ============================================
// 3. JADWAL BELAJAR (STUDY SCHEDULES)
// ============================================

/**
 * Buat atau jadwalkan sesi belajar mandiri baru.
 */
export async function createStudyScheduleAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireAuth();

    const title = formData.get("title")?.toString().trim();
    const scheduledDate = formData.get("scheduledDate")?.toString().trim();
    const courseIdRaw = formData.get("courseId")?.toString().trim();
    const courseId = courseIdRaw && courseIdRaw.length > 0 ? courseIdRaw : null;

    if (!title || title.length < 2) {
      return { ok: false, error: "Judul agenda belajar minimal 2 karakter." };
    }
    if (!scheduledDate || !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
      return { ok: false, error: "Format tanggal tidak valid (harus YYYY-MM-DD)." };
    }

    await db.insert(studySchedules).values({
      userId: user.id,
      courseId,
      title,
      scheduledDate,
    });

    revalidatePath("/siswa/jadwal");

    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menambahkan jadwal belajar.";
    return { ok: false, error: message };
  }
}

/**
 * Hapus satu agenda belajar milik user.
 */
export async function deleteStudyScheduleAction(
  scheduleId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireAuth();

    const [row] = await db
      .select({ id: studySchedules.id, userId: studySchedules.userId })
      .from(studySchedules)
      .where(eq(studySchedules.id, scheduleId))
      .limit(1);

    if (!row) {
      return { ok: false, error: "Jadwal belajar tidak ditemukan." };
    }

    if (row.userId !== user.id) {
      return { ok: false, error: "Anda tidak berhak menghapus jadwal ini." };
    }

    await db.delete(studySchedules).where(eq(studySchedules.id, scheduleId));
    revalidatePath("/siswa/jadwal");

    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menghapus jadwal belajar.";
    return { ok: false, error: message };
  }
}

// ============================================
// 4. PROFIL PENGGUNA
// ============================================

/**
 * Perbarui profil dasar (Nama & Bio) dan opsional ganti kata sandi.
 */
export async function updateProfileAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ ok: boolean; error?: string; successMessage?: string }> {
  try {
    const user = await requireAuth();

    const name = formData.get("name")?.toString().trim();
    const bio = formData.get("bio")?.toString().trim() || "";
    const currentPassword = formData.get("currentPassword")?.toString() || "";
    const newPassword = formData.get("newPassword")?.toString() || "";

    if (!name || name.length < 2) {
      return { ok: false, error: "Nama lengkap minimal 2 karakter." };
    }

    // Ambil data user dari DB
    const [dbUser] = await db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!dbUser) {
      return { ok: false, error: "Pengguna tidak ditemukan." };
    }

    const updates: Partial<{ name: string; bio: string; passwordHash: string }> = {
      name,
      bio,
    };

    // Jika ingin ganti kata sandi
    if (newPassword.length > 0) {
      if (newPassword.length < 6) {
        return { ok: false, error: "Kata sandi baru minimal 6 karakter." };
      }
      if (!currentPassword) {
        return { ok: false, error: "Kata sandi saat ini wajib diisi untuk mengganti kata sandi." };
      }

      const match = await bcrypt.compare(currentPassword, dbUser.passwordHash);
      if (!match) {
        return { ok: false, error: "Kata sandi saat ini tidak tepat." };
      }

      updates.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    await db.update(users).set(updates).where(eq(users.id, user.id));

    revalidatePath("/siswa/profil");
    revalidatePath("/instruktur/profil");
    revalidatePath("/admin/profil");

    return {
      ok: true,
      successMessage: newPassword.length > 0
        ? "Profil dan kata sandi berhasil diperbarui!"
        : "Profil berhasil diperbarui!",
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memperbarui profil.";
    return { ok: false, error: message };
  }
}
