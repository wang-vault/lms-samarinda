"use server";

// Server actions manajemen video & progress menonton

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { videos, videoProgress, courses } from "@/db/schema";
import { requireRole } from "@/lib/auth-helpers";
import {
  saveVideoFile,
  deleteVideoFile,
  readMp4DurationSeconds,
} from "@/lib/file-storage";

export type ActionState = {
  error?: string;
  success?: string;
};

// ============================================
// VIDEO (Instruktur)
// ============================================

/** Instruktur mengunggah video baru ke salah satu kursusnya. */
export async function createVideoAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireRole("instruktur");

  const courseId = String(formData.get("courseId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const orderRaw = String(formData.get("orderIndex") ?? "").trim();
  const file = formData.get("file");

  if (!courseId) return { error: "Kursus wajib dipilih." };
  if (!title) return { error: "Judul video wajib diisi." };
  if (title.length > 200) return { error: "Judul maksimal 200 karakter." };

  // Pastikan kursus ini milik instruktur yang login
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.instructorId, user.id)))
    .limit(1);
  if (!course) return { error: "Kursus tidak ditemukan." };

  if (!(file instanceof File) || file.size === 0) {
    return { error: "File video wajib diunggah." };
  }

  let filePath: string;
  let durationSeconds = 0;
  try {
    filePath = await saveVideoFile(file);
    // Ambil durasi dari metadata MP4 (0 jika tidak terbaca / format WebM)
    durationSeconds = Math.round(await readMp4DurationSeconds(filePath));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan video." };
  }

  // orderIndex: ambil dari form, atau letakkan di akhir urutan kursus
  let orderIndex = Number(orderRaw);
  if (!Number.isFinite(orderIndex) || orderIndex < 0) {
    const last = await db
      .select({ orderIndex: videos.orderIndex })
      .from(videos)
      .where(eq(videos.courseId, courseId))
      .orderBy(desc(videos.orderIndex))
      .limit(1);
    orderIndex = (last[0]?.orderIndex ?? -1) + 1;
  }

  await db.insert(videos).values({
    courseId,
    title,
    description,
    filePath,
    durationSeconds,
    orderIndex,
    createdBy: user.id,
  });

  revalidatePath("/instruktur/video");
  revalidatePath(`/instruktur/kursus/${courseId}`);
  return { success: "Video berhasil diunggah." };
}

/** Update metadata video (hanya pemilik kursus). */
export async function updateVideoAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireRole("instruktur");

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const orderRaw = String(formData.get("orderIndex") ?? "").trim();

  if (!id || !title) return { error: "Data tidak lengkap." };

  const [video] = await db
    .select({
      id: videos.id,
      courseInstructor: courses.instructorId,
    })
    .from(videos)
    .leftJoin(courses, eq(videos.courseId, courses.id))
    .where(eq(videos.id, id))
    .limit(1);
  if (!video || video.courseInstructor !== user.id) {
    return { error: "Video tidak ditemukan." };
  }

  const orderIndex = Number(orderRaw);
  await db
    .update(videos)
    .set({
      title,
      description,
      orderIndex: Number.isFinite(orderIndex) && orderIndex >= 0 ? orderIndex : 0,
    })
    .where(eq(videos.id, id));

  revalidatePath("/instruktur/video");
  return { success: "Video berhasil diperbarui." };
}

/** Hapus video beserta file di disk (hanya pemilik kursus). */
export async function deleteVideoAction(id: string): Promise<void> {
  const user = await requireRole("instruktur");

  const [video] = await db
    .select({
      id: videos.id,
      filePath: videos.filePath,
      courseInstructor: courses.instructorId,
    })
    .from(videos)
    .leftJoin(courses, eq(videos.courseId, courses.id))
    .where(eq(videos.id, id))
    .limit(1);
  if (!video || video.courseInstructor !== user.id) return;

  await db.delete(videos).where(eq(videos.id, id));
  await deleteVideoFile(video.filePath);

  revalidatePath("/instruktur/video");
}

// ============================================
// PROGRESS (Siswa)
// ============================================

/**
 * Catat / perbarui progress menonton seorang siswa.
 * Dipanggil dari client saat video sedang diputar (setiap beberapa detik).
 */
export async function updateVideoProgressAction(
  videoId: string,
  watchedSeconds: number,
  totalSeconds: number
): Promise<void> {
  const user = await requireRole("siswa");

  if (!videoId) return;
  const seconds = Math.max(0, Math.min(Math.floor(watchedSeconds), Math.floor(totalSeconds)));

  // Dianggap selesai jika sudah menonton >= 90% durasi (atau durasi tidak diketahui)
  const watched =
    totalSeconds > 0 ? seconds >= Math.floor(totalSeconds * 0.9) : false;

  const [existing] = await db
    .select({ id: videoProgress.id, watched: videoProgress.watched, watchedSeconds: videoProgress.watchedSeconds })
    .from(videoProgress)
    .where(and(eq(videoProgress.videoId, videoId), eq(videoProgress.userId, user.id)))
    .limit(1);

  if (existing) {
    // Jangan menurunkan progres yang sudah ada / status selesai
    await db
      .update(videoProgress)
      .set({
        watched: existing.watched || watched,
        watchedSeconds: Math.max(existing.watchedSeconds, seconds),
        watchedAt: new Date(),
      })
      .where(eq(videoProgress.id, existing.id));
  } else {
    await db.insert(videoProgress).values({
      videoId,
      userId: user.id,
      watched,
      watchedSeconds: seconds,
    });
  }
}

/** Tandai video sebagai selesai ditonton (tombol "Selesai"). */
export async function markVideoWatchedAction(videoId: string): Promise<void> {
  const user = await requireRole("siswa");
  if (!videoId) return;

  const [existing] = await db
    .select({ id: videoProgress.id })
    .from(videoProgress)
    .where(and(eq(videoProgress.videoId, videoId), eq(videoProgress.userId, user.id)))
    .limit(1);

  if (existing) {
    await db
      .update(videoProgress)
      .set({ watched: true, watchedAt: new Date() })
      .where(eq(videoProgress.id, existing.id));
  } else {
    await db.insert(videoProgress).values({
      videoId,
      userId: user.id,
      watched: true,
      watchedSeconds: 0,
    });
  }
}
