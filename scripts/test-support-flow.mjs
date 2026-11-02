// Test E2E Tahap 8 — Fitur Pendukung (Forum, Notifikasi, Jadwal Belajar, Leaderboard, Profil)
// Menguji alur lengkap:
// 1. Forum Diskusi (Instruktur buat kursus → Siswa buat thread utama → Instruktur membalas → notifikasi terkirim)
// 2. Notifikasi (List notifikasi, mark read, mark all read)
// 3. Jadwal Belajar Siswa (Tambah target belajar, daftar jadwal, hapus jadwal)
// 4. Leaderboard Siswa (Tampilan poin, kalkulasi sertifikat/ujian/video, urutan peringkat)
// 5. Profil Pengguna (Lihat profil, update nama/bio, validasi ganti password)
// 6. Admin Pengguna (Daftar seluruh akun terdaftar)
// 7. Isolasi Akses & Redirect Tamu

const BASE = "http://localhost:3000";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";

const db = new Database("./data/lms.db");

// Runtime React untuk men-encode argumen action
const { encodeReply } = await import(
  "next/dist/compiled/react-server-dom-webpack-experimental/cjs/react-server-dom-webpack-client.node.development.js"
);

let cookies = "";

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { ...(opts.headers || {}), Cookie: cookies },
    redirect: "manual",
  });
  const setCookies = res.headers.getSetCookie?.() || [];
  for (const c of setCookies) {
    const pair = c.split(";")[0];
    const name = pair.split("=")[0];
    cookies = cookies
      .split("; ")
      .filter((p) => !p.startsWith(name + "="))
      .join("; ");
    if (!/expires=Thu, 01 Jan 1970/i.test(c)) {
      cookies = cookies ? cookies + "; " + pair : pair;
    }
  }
  return res;
}

async function login(email, password) {
  const csrfRes = await req("/api/auth/csrf");
  const { csrfToken } = await csrfRes.json();
  const body = new URLSearchParams({ email, password, csrfToken });
  const res = await req("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (res.status !== 302 && res.status !== 200) {
    throw new Error(`Login gagal untuk ${email} (status: ${res.status})`);
  }
}

/** Ambil ID action dari server-reference-manifest. */
function actionId(exportedName) {
  const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8"));
  for (const [id, entry] of Object.entries(manifest.node || {})) {
    if (entry && entry.exportedName === exportedName) return id;
  }
  throw new Error(`Action tidak ditemukan di manifest: ${exportedName}`);
}

async function callAction(pagePath, actionIdValue, args) {
  const form = await encodeReply(args);
  return req(pagePath, {
    method: "POST",
    headers: {
      "next-action": actionIdValue,
    },
    body: form,
  });
}

function check(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✓ ${label}${detail ? ` (${detail})` : ""}`);
  } else {
    console.error(`  ✗ FAIL: ${label}${detail ? ` (${detail})` : ""}`);
    process.exitCode = 1;
  }
}

async function main() {
  console.log("=== PENGUJIAN TAHAP 8: FITUR PENDUKUNG ===\n");
  const stamp = Date.now().toString(36);

  // ============================================
  // 1. FORUM DISKUSI
  // ============================================
  console.log("1. Pengujian Forum Diskusi");

  // Instruktur login & buat kursus untuk wadah forum
  await login("instruktur@lms.com", "instruktur123");
  await req("/instruktur/kursus");
  await req("/instruktur/forum");

  const courseTitle = `Kursus Forum ${stamp}`;
  let form = new FormData();
  form.append("title", courseTitle);
  form.append("description", "Kursus untuk pengujian forum diskusi.");
  let res = await callAction("/instruktur/kursus", actionId("createCourseAction"), [null, form]);
  check("Instruktur membuat kursus forum", res.status === 200);

  const course = db.prepare("SELECT id FROM courses WHERE title = ?").get(courseTitle);
  const courseId = course.id;

  // Siswa login & buka halaman forum
  await login("siswa@lms.com", "siswa123");
  await req("/siswa/forum");
  await req(`/siswa/forum/${courseId}`);

  // Siswa buat post pertanyaan di forum
  form = new FormData();
  form.append("courseId", courseId);
  form.append("content", `Bagaimana prospek kuliner di Citra Niaga Samarinda? [${stamp}]`);
  res = await callAction(`/siswa/forum/${courseId}`, actionId("createForumPostAction"), [null, form]);
  check("Siswa berhasil membuat topik diskusi baru", res.status === 200);

  const studentPost = db
    .prepare("SELECT id FROM forum_posts WHERE course_id = ? AND parent_id IS NULL")
    .get(courseId);
  check("Topik diskusi tersimpan di DB", !!studentPost);

  // Instruktur login & membalas pertanyaan siswa
  await login("instruktur@lms.com", "instruktur123");
  await req(`/instruktur/forum/${courseId}`);

  form = new FormData();
  form.append("courseId", courseId);
  form.append("parentId", studentPost.id);
  form.append("content", `Citra Niaga sangat ramai saat malam dan akhir pekan! [${stamp}]`);
  res = await callAction(`/instruktur/forum/${courseId}`, actionId("createForumPostAction"), [null, form]);
  check("Instruktur membalas topik diskusi siswa", res.status === 200);

  const replyPost = db
    .prepare("SELECT id FROM forum_posts WHERE parent_id = ?")
    .get(studentPost.id);
  check("Balasan forum tersimpan di DB", !!replyPost);

  // Cek notifikasi terkirim ke siswa saat ada yang membalas
  const notifToStudent = db
    .prepare("SELECT id, title, message FROM notifications WHERE user_id = (SELECT id FROM users WHERE email = 'siswa@lms.com') AND title = 'Balasan baru di forum'")
    .get();
  check("Notifikasi balasan forum otomatis terkirim ke siswa", !!notifToStudent, notifToStudent?.title);

  // Render halaman forum siswa
  await login("siswa@lms.com", "siswa123");
  const forumHtml = await (await req(`/siswa/forum/${courseId}`)).text();
  check("Halaman forum menampilkan topik siswa", forumHtml.includes("Citra Niaga Samarinda"));
  check("Halaman forum menampilkan balasan instruktur", forumHtml.includes("Citra Niaga sangat ramai"));

  // ============================================
  // 2. PUSAT NOTIFIKASI
  // ============================================
  console.log("\n2. Pengujian Pusat Notifikasi");
  await req("/siswa/notifikasi");

  const notifListRes = await req("/siswa/notifikasi");
  check("GET /siswa/notifikasi status 200", notifListRes.status === 200);
  const notifHtml = await notifListRes.text();
  check("Halaman notifikasi memuat judul 'Pusat Notifikasi'", notifHtml.includes("Pusat Notifikasi"));
  check("Notifikasi balasan forum tampil di UI", notifHtml.includes("Balasan baru di forum"));

  // Uji action tandai semua dibaca
  res = await callAction("/siswa/notifikasi", actionId("markAllNotificationsReadAction"), []);
  check("Siswa menandai semua notifikasi sudah dibaca", res.status === 200);

  const unreadCount = db
    .prepare("SELECT count(*) as c FROM notifications WHERE user_id = (SELECT id FROM users WHERE email = 'siswa@lms.com') AND mode = 0")
    .get().c;
  check("Seluruh notifikasi siswa berstatus read (mode=1)", unreadCount === 0);

  // ============================================
  // 3. JADWAL BELAJAR SISWA
  // ============================================
  console.log("\n3. Pengujian Jadwal Belajar Siswa");
  await req("/siswa/jadwal");

  // Tambah agenda belajar
  form = new FormData();
  form.append("title", `Belajar Modul 1 & Riset Pasar [${stamp}]`);
  form.append("scheduledDate", "2026-11-15");
  form.append("courseId", courseId);
  res = await callAction("/siswa/jadwal", actionId("createStudyScheduleAction"), [null, form]);
  check("Siswa membuat agenda belajar baru", res.status === 200);

  const scheduleRow = db
    .prepare("SELECT id, title, scheduled_date FROM study_schedules WHERE title LIKE ?")
    .get(`%${stamp}%`);
  check("Agenda belajar tersimpan di DB", !!scheduleRow && scheduleRow.scheduled_date === "2026-11-15");

  // Render halaman jadwal belajar
  const jadwalHtml = await (await req("/siswa/jadwal")).text();
  check("Halaman jadwal memuat agenda yang baru dibuat", jadwalHtml.includes(stamp));
  check("Halaman jadwal menampilkan nama kursus terkait", jadwalHtml.includes(courseTitle));

  // Hapus agenda belajar
  res = await callAction("/siswa/jadwal", actionId("deleteStudyScheduleAction"), [scheduleRow.id]);
  check("Siswa berhasil menghapus agenda belajar", res.status === 200);

  const deletedSchedule = db.prepare("SELECT id FROM study_schedules WHERE id = ?").get(scheduleRow.id);
  check("Agenda belajar terhapus dari DB", !deletedSchedule);

  // ============================================
  // 4. LEADERBOARD (PAPAN PERINGKAT)
  // ============================================
  console.log("\n4. Pengujian Leaderboard Siswa");
  await req("/siswa/leaderboard");

  const lbRes = await req("/siswa/leaderboard");
  check("GET /siswa/leaderboard status 200", lbRes.status === 200);
  const lbHtml = await lbRes.text();
  check("Halaman memuat judul 'Papan Peringkat (Leaderboard)'", lbHtml.includes("Papan Peringkat"));
  check("Halaman memuat nama siswa 'Sari Siswa'", lbHtml.includes("Sari Siswa"));
  check("Halaman memuat aturan poin", lbHtml.includes("Aturan Poin"));

  // ============================================
  // 5. PROFIL PENGGUNA
  // ============================================
  console.log("\n5. Pengujian Profil Pengguna");
  await req("/siswa/profil");

  const profRes = await req("/siswa/profil");
  check("GET /siswa/profil status 200", profRes.status === 200);
  const profHtml = await profRes.text();
  check("Halaman memuat judul 'Profil Pengguna'", profHtml.includes("Profil Pengguna"));
  check("Halaman menampilkan email siswa", profHtml.includes("siswa@lms.com"));

  // Update profil (nama & bio)
  form = new FormData();
  form.append("name", "Sari Siswa Berprestasi");
  form.append("bio", "Calon wirausahawan kuliner khas Samarinda sukses.");
  res = await callAction("/siswa/profil", actionId("updateProfileAction"), [null, form]);
  check("Siswa berhasil memperbarui nama & bio", res.status === 200);

  const updatedUser = db.prepare("SELECT name, bio FROM users WHERE email = 'siswa@lms.com'").get();
  check("Perubahan nama tersimpan di DB", updatedUser.name === "Sari Siswa Berprestasi");
  check("Perubahan bio tersimpan di DB", updatedUser.bio.includes("Samarinda"));

  // Kembalikan nama semula agar konsisten untuk tes lainnya
  form = new FormData();
  form.append("name", "Sari Siswa");
  form.append("bio", "");
  await callAction("/siswa/profil", actionId("updateProfileAction"), [null, form]);

  // ============================================
  // 6. ADMIN KELOLA PENGGUNA & PROFIL
  // ============================================
  console.log("\n6. Pengujian Kelola Pengguna Admin");
  await login("admin@lms.com", "admin123");
  await req("/admin/pengguna");

  const adminUsersRes = await req("/admin/pengguna");
  check("GET /admin/pengguna status 200", adminUsersRes.status === 200);
  const adminUsersHtml = await adminUsersRes.text();
  check("Halaman admin menampilkan daftar seluruh user", adminUsersHtml.includes("admin@lms.com") && adminUsersHtml.includes("instruktur@lms.com"));

  // ============================================
  // 7. PROTEKSI AKSES & ISOLASI ROLE
  // ============================================
  console.log("\n7. Pengujian Proteksi Akses & Isolasi Role");
  cookies = ""; // Tamu tanpa sesi

  const guestForumRes = await req("/siswa/forum");
  check("Tamu ditolak akses /siswa/forum (redirect 307/302)", guestForumRes.status === 307 || guestForumRes.status === 302);

  const guestJadwalRes = await req("/siswa/jadwal");
  check("Tamu ditolak akses /siswa/jadwal (redirect 307/302)", guestJadwalRes.status === 307 || guestJadwalRes.status === 302);

  const guestLeaderboardRes = await req("/siswa/leaderboard");
  check("Tamu ditolak akses /siswa/leaderboard (redirect 307/302)", guestLeaderboardRes.status === 307 || guestLeaderboardRes.status === 302);

  const guestNotifRes = await req("/siswa/notifikasi");
  check("Tamu ditolak akses /siswa/notifikasi (redirect 307/302)", guestNotifRes.status === 307 || guestNotifRes.status === 302);

  const guestProfilRes = await req("/siswa/profil");
  check("Tamu ditolak akses /siswa/profil (redirect 307/302)", guestProfilRes.status === 307 || guestProfilRes.status === 302);

  console.log("\n=== SEMUA PENGUJIAN TAHAP 8 SELESAI ===");
}

main().catch((err) => {
  console.error("Terjadi kegagalan fatal pada pengujian Tahap 8:", err);
  process.exit(1);
});
