"use server";

// Server actions manajemen kursus & materi

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  courses,
  materials,
  notifications,
  users,
  type MaterialStatus,
} from "@/db/schema";
import { requireRole } from "@/lib/auth-helpers";
import { saveMaterialFile, deleteMaterialFile } from "@/lib/file-storage";

export type ActionState = {
  error?: string;
  success?: string;
};

// ============================================
// KURSUS
// ============================================

/** Instruktur membuat kursus baru. */
export async function createCourseAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireRole("instruktur");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!title) return { error: "Judul kursus wajib diisi." };
  if (title.length > 200) return { error: "Judul maksimal 200 karakter." };

  await db.insert(courses).values({
    title,
    description,
    instructorId: user.id,
  });

  revalidatePath("/instruktur/kursus");
  return { success: "Kursus berhasil dibuat." };
}

/** Update kursus (hanya pemilik). */
export async function updateCourseAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireRole("instruktur");
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!id || !title) return { error: "Data tidak lengkap." };

  const [course] = await db
    .select({ id: courses.id, instructorId: courses.instructorId })
    .from(courses)
    .where(eq(courses.id, id))
    .limit(1);

  if (!course) return { error: "Kursus tidak ditemukan." };
  if (course.instructorId !== user.id) return { error: "Bukan kursus milikmu." };

  await db
    .update(courses)
    .set({ title, description })
    .where(eq(courses.id, id));

  revalidatePath("/instruktur/kursus");
  return { success: "Kursus berhasil diperbarui." };
}

/** Hapus kursus (hanya pemilik). */
export async function deleteCourseAction(id: string): Promise<ActionState> {
  const user = await requireRole("instruktur");

  const [course] = await db
    .select({ id: courses.id, instructorId: courses.instructorId })
    .from(courses)
    .where(eq(courses.id, id))
    .limit(1);

  if (!course) return { error: "Kursus tidak ditemukan." };
  if (course.instructorId !== user.id) return { error: "Bukan kursus milikmu." };

  // Hapus file PDF semua materi dalam kursus ini
  const mats = await db
    .select({ filePath: materials.filePath })
    .from(materials)
    .where(eq(materials.courseId, id));
  for (const m of mats) {
    if (m.filePath) await deleteMaterialFile(m.filePath);
  }

  await db.delete(courses).where(eq(courses.id, id));

  revalidatePath("/instruktur/kursus");
  return { success: "Kursus berhasil dihapus." };
}

// ============================================
// MATERI
// ============================================

/** Instruktur membuat materi (teks atau PDF). */
export async function createMaterialAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireRole("instruktur");

  const courseId = String(formData.get("courseId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "teks");
  const content = String(formData.get("content") ?? "").trim();
  const file = formData.get("file") as File | null;

  if (!courseId || !title) return { error: "Kursus dan judul wajib diisi." };

  // Pastikan kursus milik instruktur ini
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!course) return { error: "Kursus tidak ditemukan." };

  let filePath: string | null = null;
  let savedType: "teks" | "pdf" = "teks";

  if (type === "pdf") {
    if (!file || !(file instanceof File) || file.size === 0) {
      return { error: "File PDF wajib diunggah." };
    }
    try {
      filePath = await saveMaterialFile(file);
      savedType = "pdf";
    } catch (err) {
      return {
        error:
          err instanceof Error ? err.message : "Gagal mengunggah file.",
      };
    }
  } else {
    if (!content) return { error: "Konten teks wajib diisi." };
  }

  await db.insert(materials).values({
    courseId,
    title,
    type: savedType,
    content,
    filePath,
    status: "pending",
    createdBy: user.id,
  });

  // Notifikasi ke semua admin: ada materi baru menunggu approval
  const admins = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"));
  if (admins.length > 0) {
    await db.insert(notifications).values(
      admins.map((a) => ({
        userId: a.id,
        title: "Materi baru menunggu approval",
        message: `Materi "${title}" menunggu disetujui.`,
        type: "info",
      }))
    );
  }

  revalidatePath("/instruktur/materi");
  revalidatePath("/admin/materi");
  return { success: "Materi berhasil dibuat, menunggu approval admin." };
}

/** Hapus materi (instruktur pemilik). */
export async function deleteMaterialAction(id: string): Promise<ActionState> {
  const user = await requireRole("instruktur");

  const [mat] = await db
    .select({
      id: materials.id,
      createdBy: materials.createdBy,
      filePath: materials.filePath,
    })
    .from(materials)
    .where(eq(materials.id, id))
    .limit(1);

  if (!mat) return { error: "Materi tidak ditemukan." };
  if (mat.createdBy !== user.id) return { error: "Bukan materi milikmu." };

  if (mat.filePath) await deleteMaterialFile(mat.filePath);
  await db.delete(materials).where(eq(materials.id, id));

  revalidatePath("/instruktur/materi");
  revalidatePath("/admin/materi");
  return { success: "Materi berhasil dihapus." };
}

/** Admin menyetujui materi. */
export async function approveMaterialAction(id: string): Promise<ActionState> {
  await requireRole("admin");

  const [mat] = await db
    .select({
      id: materials.id,
      title: materials.title,
      createdBy: materials.createdBy,
    })
    .from(materials)
    .where(eq(materials.id, id))
    .limit(1);

  if (!mat) return { error: "Materi tidak ditemukan." };

  await db
    .update(materials)
    .set({ status: "approved" satisfies MaterialStatus, approvedAt: new Date(), rejectionReason: null })
    .where(eq(materials.id, id));

  await db.insert(notifications).values({
    userId: mat.createdBy,
    title: "Materi disetujui",
    message: `Materi "${mat.title}" telah disetujui dan kini tersedia untuk siswa.`,
    type: "success",
  });

  revalidatePath("/admin/materi");
  revalidatePath("/instruktur/materi");
  revalidatePath("/siswa/materi");
  return { success: "Materi disetujui." };
}

/** Admin menolak materi. */
export async function rejectMaterialAction(
  id: string,
  reason: string
): Promise<ActionState> {
  await requireRole("admin");

  const [mat] = await db
    .select({
      id: materials.id,
      title: materials.title,
      createdBy: materials.createdBy,
    })
    .from(materials)
    .where(eq(materials.id, id))
    .limit(1);

  if (!mat) return { error: "Materi tidak ditemukan." };
  if (!reason.trim()) return { error: "Alasan penolakan wajib diisi." };

  await db
    .update(materials)
    .set({
      status: "rejected" satisfies MaterialStatus,
      rejectionReason: reason.trim(),
      approvedAt: null,
    })
    .where(eq(materials.id, id));

  await db.insert(notifications).values({
    userId: mat.createdBy,
    title: "Materi ditolak",
    message: `Materi "${mat.title}" ditolak. Alasan: ${reason.trim()}`,
    type: "warning",
  });

  revalidatePath("/admin/materi");
  revalidatePath("/instruktur/materi");
  return { success: "Materi ditolak." };
}
