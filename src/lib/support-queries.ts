// Query helper untuk Fitur Pendukung (Forum, Notifikasi, Jadwal Belajar, Leaderboard, Profil)
// Terstruktur rapi untuk dipanggil dari server component

import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  forumPosts,
  notifications,
  studySchedules,
  users,
  courses,
  certificates,
  quizSubmissions,
  videoProgress,
} from "@/db/schema";

// ============================================
// 1. FORUM DISKUSI
// ============================================

export type ForumPostWithAuthor = {
  id: string;
  courseId: string;
  userId: string;
  userName: string;
  userRole: string;
  parentId: string | null;
  content: string;
  createdAt: Date;
  replies?: ForumPostWithAuthor[];
};

/** Ambil semua kursus yang tersedia untuk forum */
export async function getForumCourses() {
  return db
    .select({
      id: courses.id,
      title: courses.title,
      description: courses.description,
    })
    .from(courses)
    .orderBy(desc(courses.createdAt));
}

/** Ambil thread diskusi untuk satu kursus (topik utama + daftar balasannya) */
export async function getCourseForumThreads(
  courseId: string
): Promise<ForumPostWithAuthor[]> {
  const rows = await db
    .select({
      id: forumPosts.id,
      courseId: forumPosts.courseId,
      userId: forumPosts.userId,
      userName: users.name,
      userRole: users.role,
      parentId: forumPosts.parentId,
      content: forumPosts.content,
      createdAt: forumPosts.createdAt,
    })
    .from(forumPosts)
    .innerJoin(users, eq(forumPosts.userId, users.id))
    .where(eq(forumPosts.courseId, courseId))
    .orderBy(desc(forumPosts.createdAt));

  // Pisahkan root posts dan replies
  const rootPosts: ForumPostWithAuthor[] = [];
  const repliesMap = new Map<string, ForumPostWithAuthor[]>();

  for (const post of rows) {
    if (post.parentId) {
      const list = repliesMap.get(post.parentId) || [];
      list.push(post);
      repliesMap.set(post.parentId, list);
    } else {
      rootPosts.push({ ...post, replies: [] });
    }
  }

  // Kaitkan replies ke root post (diurutkan kronologis lama -> baru agar enak dibaca)
  for (const root of rootPosts) {
    const r = repliesMap.get(root.id) || [];
    r.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    root.replies = r;
  }

  return rootPosts;
}

// ============================================
// 2. NOTIFIKASI
// ============================================

export type NotificationItem = {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: Date;
};

/** Ambil seluruh notifikasi milik user */
export async function getUserNotifications(
  userId: string
): Promise<NotificationItem[]> {
  const rows = await db
    .select({
      id: notifications.id,
      userId: notifications.userId,
      title: notifications.title,
      message: notifications.message,
      type: notifications.type,
      read: notifications.read,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt));

  return rows;
}

/** Hitung jumlah notifikasi yang belum dibaca */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const [res] = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));

  return Number(res?.count || 0);
}

// ============================================
// 3. JADWAL BELAJAR
// ============================================

export type ScheduleItem = {
  id: string;
  userId: string;
  courseId: string | null;
  courseTitle: string | null;
  title: string;
  scheduledDate: string;
  createdAt: Date;
};

/** Ambil semua agenda belajar milik user */
export async function getUserStudySchedules(
  userId: string
): Promise<ScheduleItem[]> {
  const rows = await db
    .select({
      id: studySchedules.id,
      userId: studySchedules.userId,
      courseId: studySchedules.courseId,
      courseTitle: courses.title,
      title: studySchedules.title,
      scheduledDate: studySchedules.scheduledDate,
      createdAt: studySchedules.createdAt,
    })
    .from(studySchedules)
    .leftJoin(courses, eq(studySchedules.courseId, courses.id))
    .where(eq(studySchedules.userId, userId))
    .orderBy(studySchedules.scheduledDate);

  return rows;
}

// ============================================
// 4. LEADERBOARD (PAPAN PERINGKAT SISWA)
// ============================================

export type LeaderboardEntry = {
  userId: string;
  userName: string;
  rank: number;
  totalCertificates: number;
  totalPassedQuizzes: number;
  totalWatchedVideos: number;
  averageScore: number;
  totalPoints: number;
};

/**
 * Hitung peringkat belajar siswa:
 * Poin dihitung dari:
 * - Setiap sertifikat kelulusan = 100 poin
 * - Rata-rata nilai ujian yang lulus
 * - Setiap video yang selesai ditonton = 10 poin
 */
export async function getStudentLeaderboard(): Promise<LeaderboardEntry[]> {
  // Ambil semua siswa
  const siswaList = await db
    .select({
      id: users.id,
      name: users.name,
    })
    .from(users)
    .where(eq(users.role, "siswa"));

  if (siswaList.length === 0) return [];

  // Ambil sertifikat
  const certList = await db
    .select({
      userId: certificates.userId,
      score: certificates.score,
    })
    .from(certificates);

  // Ambil video progress
  const videoList = await db
    .select({
      userId: videoProgress.userId,
    })
    .from(videoProgress)
    .where(eq(videoProgress.watched, true));

  // Ambil submission yang lulus
  const passedList = await db
    .select({
      userId: quizSubmissions.userId,
      score: quizSubmissions.score,
    })
    .from(quizSubmissions)
    .where(and(eq(quizSubmissions.status, "submitted"), eq(quizSubmissions.passed, true)));

  const entries: LeaderboardEntry[] = siswaList.map((s) => {
    const userCerts = certList.filter((c) => c.userId === s.id);
    const userVideos = videoList.filter((v) => v.userId === s.id);
    const userPassed = passedList.filter((p) => p.userId === s.id);

    const certCount = userCerts.length;
    const videoCount = userVideos.length;
    const passedCount = userPassed.length;

    const avgScore =
      userPassed.length > 0
        ? Math.round(
            userPassed.reduce((acc, curr) => acc + curr.score, 0) / userPassed.length
          )
        : 0;

    // Formula gamifikasi:
    // (Jumlah sertifikat * 100) + (Rata-rata nilai) + (Jumlah video * 10)
    const totalPoints = certCount * 100 + avgScore + videoCount * 10;

    return {
      userId: s.id,
      userName: s.name,
      rank: 0,
      totalCertificates: certCount,
      totalPassedQuizzes: passedCount,
      totalWatchedVideos: videoCount,
      averageScore: avgScore,
      totalPoints,
    };
  });

  // Urutkan poin tertinggi lebih dulu
  entries.sort((a, b) => b.totalPoints - a.totalPoints || b.averageScore - a.averageScore);

  // Berikan nomor peringkat
  entries.forEach((e, idx) => {
    e.rank = idx + 1;
  });

  return entries;
}

// ============================================
// 5. PROFIL PENGGUNA
// ============================================

export async function getUserProfile(userId: string) {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      bio: users.bio,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user ?? null;
}
