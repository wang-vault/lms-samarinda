// Schema database LMS "Mulai Usaha dari Nol di Samarinda"
// Menggunakan Drizzle ORM + SQLite

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { SQL } from "drizzle-orm";

// ============================================
// ENUM / KONSTANTA
// ============================================

export const USER_ROLES = ["admin", "instruktur", "siswa"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const MATERIAL_STATUS = ["pending", "approved", "rejected"] as const;
export type MaterialStatus = (typeof MATERIAL_STATUS)[number];

export const QUIZ_QUESTION_TYPES = ["pilihan_ganda", "essay"] as const;
export type QuizQuestionType = (typeof QUIZ_QUESTION_TYPES)[number];

// Status pengerjaan ujian: draft = auto-save, submitted = sudah diserahkan
export const QUIZ_SUBMISSION_STATUS = ["draft", "submitted"] as const;
export type QuizSubmissionStatus = (typeof QUIZ_SUBMISSION_STATUS)[number];

// ============================================
// TABEL
// ============================================

// Pengguna sistem (admin, instruktur, siswa)
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: USER_ROLES }).notNull().default("siswa"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Kursus / mata pelajaran
export const courses = sqliteTable("courses", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  coverUrl: text("cover_url"),
  instructorId: text("instructor_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Materi pembelajaran (teks / PDF), butuh approval admin
export const materials = sqliteTable("materials", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  // "teks" atau "pdf"
  type: text("type").notNull().default("teks"),
  content: text("content").notNull().default(""),
  filePath: text("file_path"),
  status: text("status", { enum: MATERIAL_STATUS })
    .notNull()
    .default("pending"),
  rejectionReason: text("rejection_reason"),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  approvedAt: integer("approved_at", { mode: "timestamp" }),
});

// Video pembelajaran per kursus
export const videos = sqliteTable("videos", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  filePath: text("file_path").notNull(),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  orderIndex: integer("order_index").notNull().default(0),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Progress tonton video per siswa
export const videoProgress = sqliteTable("video_progress", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  videoId: text("video_id")
    .notNull()
    .references(() => videos.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  watched: integer("mode", { mode: "boolean" }).notNull().default(false),
  watchedSeconds: integer("watched_seconds").notNull().default(0),
  watchedAt: integer("watched_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Quiz / ujian per kursus
export const quizzes = sqliteTable("quizzes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  // Durasi ujian dalam menit
  durationMinutes: integer("duration_minutes").notNull().default(30),
  // Nilai minimum untuk lulus (0-100)
  passingScore: integer("passing_score").notNull().default(70),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Soal quiz
export const quizQuestions = sqliteTable("quiz_questions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  quizId: text("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  // "pilihan_ganda" atau "essay"
  type: text("type", { enum: QUIZ_QUESTION_TYPES }).notNull(),
  question: text("question").notNull(),
  // JSON array untuk pilihan ganda: ["Opsi A", "Opsi B", ...]
  options: text("options"),
  // Index jawaban benar (untuk pilihan ganda)
  correctOptionIndex: integer("correct_option_index"),
  // Jawaban model (untuk essay, sebagai referensi grader)
  modelAnswer: text("model_answer"),
  points: integer("points").notNull().default(1),
  orderIndex: integer("order_index").notNull().default(0),
});

// Jawaban / hasil ujian siswa
// Satu baris = satu attempt. Attempt "draft" (auto-save) tidak masuk
// perhitungan kelulusan; hanya attempt "submitted" yang dinilai.
export const quizSubmissions = sqliteTable("quiz_submissions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  quizId: text("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // JSON: [{ questionId, type, answer }]
  answers: text("answers").notNull(),
  // "draft" = auto-save, "submitted" = sudah diserahkan & dinilai otomatis
  status: text("status", { enum: QUIZ_SUBMISSION_STATUS })
    .notNull()
    .default("draft"),
  // Nilai akhir (0-100). Sama dengan autoScore sampai essay dinilai.
  score: real("score").notNull().default(0),
  // Skor pilihan ganda (sebelum essay dinilai)
  autoScore: real("auto_score").notNull().default(0),
  passed: integer("mode", { mode: "boolean" }).notNull().default(false),
  // true = essay sudah dinilai instruktur (atau quiz tidak punya soal essay)
  graded: integer("graded", { mode: "boolean" }).notNull().default(false),
  // JSON penilaian essay: [{ questionId, points, comment }]
  essayFeedback: text("essay_feedback"),
  startedAt: integer("started_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  submittedAt: integer("submitted_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Sertifikat yang diterbitkan
export const certificates = sqliteTable("certificates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  quizSubmissionId: text("quiz_submission_id")
    .notNull()
    .references(() => quizSubmissions.id, { onDelete: "cascade" }),
  certificateNumber: text("certificate_number").notNull().unique(),
  score: real("score").notNull(),
  issuedAt: integer("issued_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Enroll siswa ke kursus
export const enrollments = sqliteTable("enrollments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Forum diskusi per kursus
export const forumPosts = sqliteTable("forum_posts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // null = post utama, ada nilai = balasan
  parentId: text("parent_id"),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Notifikasi in-app
export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  // "info" | "success" | "warning"
  type: text("type").notNull().default("info"),
  read: integer("mode", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Jadwal belajar (kalender)
export const studySchedules = sqliteTable("study_schedules", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  courseId: text("course_id").references(() => courses.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  // ISO date string "2026-10-31"
  scheduledDate: text("scheduled_date").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ============================================
// TIPE UNTUK TYPESCRIPT
// ============================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Course = typeof courses.$inferSelect;
export type Material = typeof materials.$inferSelect;
export type Video = typeof videos.$inferSelect;
export type Quiz = typeof quizzes.$inferSelect;
export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type QuizSubmission = typeof quizSubmissions.$inferSelect;
export type Certificate = typeof certificates.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type ForumPost = typeof forumPosts.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type StudySchedule = typeof studySchedules.$inferSelect;

// Hindari error unused import SQL
export type _SQL = SQL;
