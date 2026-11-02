// Bersihkan data hasil test E2E dari DB + file upload (materi & video).
const D = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const db = new D("./data/lms.db");

// Folder upload (path relatif terhadap root proyek)
const MATERI_DIR = path.join("data", "uploads", "materi");
const VIDEO_DIR = path.join("data", "uploads", "videos");

let filesRemoved = 0;

// Hapus file materi yang terdaftar di DB
for (const m of db.prepare("SELECT file_path FROM materials").all()) {
  if (m.file_path) {
    try { fs.unlinkSync(path.join(MATERI_DIR, m.file_path)); filesRemoved++; } catch {}
  }
}

// Hapus file video yang terdaftar di DB
for (const v of db.prepare("SELECT file_path FROM videos").all()) {
  if (v.file_path) {
    try { fs.unlinkSync(path.join(VIDEO_DIR, v.file_path)); filesRemoved++; } catch {}
  }
}

db.exec("DELETE FROM notifications");
// Urutan hapus mengikuti relasi: quiz_questions & quiz_submissions adalah
// anak dari quizzes, quizzes anak dari courses.
db.prepare("DELETE FROM quiz_questions").run();
db.prepare("DELETE FROM quiz_submissions").run();
db.prepare("DELETE FROM quizzes").run();
db.prepare("DELETE FROM video_progress").run();
db.prepare("DELETE FROM videos").run();
db.prepare("DELETE FROM materials").run();
db.prepare("DELETE FROM courses").run();

// File yatim di folder upload (tidak terdaftar di DB manapun)
function orphanCount(dir) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).length;
}

console.log("file dihapus:", filesRemoved);
console.log("sisa courses:", db.prepare("SELECT COUNT(*) c FROM courses").get().c,
  "materials:", db.prepare("SELECT COUNT(*) c FROM materials").get().c,
  "videos:", db.prepare("SELECT COUNT(*) c FROM videos").get().c,
  "quizzes:", db.prepare("SELECT COUNT(*) c FROM quizzes").get().c,
  "quiz_questions:", db.prepare("SELECT COUNT(*) c FROM quiz_questions").get().c,
  "quiz_submissions:", db.prepare("SELECT COUNT(*) c FROM quiz_submissions").get().c,
  "video_progress:", db.prepare("SELECT COUNT(*) c FROM video_progress").get().c,
  "notifications:", db.prepare("SELECT COUNT(*) c FROM notifications").get().c);
console.log("users tersisa:", db.prepare("SELECT email, role FROM users").all().map(u => u.email + "(" + u.role + ")").join(", "));
console.log("file yatim tersisa:", orphanCount(MATERI_DIR), "di uploads/materi,",
  orphanCount(VIDEO_DIR), "di uploads/videos");
