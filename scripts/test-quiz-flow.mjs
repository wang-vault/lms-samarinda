// Test E2E Tahap 5 — alur lengkap quiz & ujian:
// instruktur buat quiz + soal PG & essay → siswa kerjakan (auto-save → submit) →
// auto-grade PG → instruktur nilai essay → siswa lihat riwayat → hapus quiz.
//
// Memakai format request server action yang SAMA dengan browser.
// Dev server harus aktif di http://localhost:3000.
const BASE = "http://localhost:3000";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";

// Runtime React untuk men-encode argumen action (sama dengan yang dipakai browser).
const { encodeReply } = await import(
  "next/dist/compiled/react-server-dom-webpack-experimental/cjs/react-server-dom-webpack-client.node.development.js"
);

const db = new Database("./data/lms.db");

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
    cookies = cookies.split("; ").filter((p) => !p.startsWith(name + "=")).join("; ");
    if (!/expires=Thu, 01 Jan 1970/i.test(c)) {
      cookies = cookies ? cookies + "; " + pair : pair;
    }
  }
  return res;
}

async function login(email, password) {
  const { csrfToken } = await (await req("/api/auth/csrf")).json();
  const body = new URLSearchParams({ email, password, csrfToken });
  const res = await req("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (res.status !== 302 && res.status !== 200) {
    throw new Error(`Login gagal: ${email} ${res.status}`);
  }
}

/** Ambil ID action dari server-reference-manifest. */
function actionId(exportedName) {
  const manifest = JSON.parse(
    readFileSync(".next/server/server-reference-manifest.json", "utf8")
  );
  for (const [id, entry] of Object.entries(manifest.node || {})) {
    if (entry && entry.exportedName === exportedName) return id;
  }
  throw new Error(`Action tidak ditemukan di manifest: ${exportedName}`);
}

// Server action dengan FormData mengembalikan nilai melalui payload RSC,
// bukan JSON. Implementasi test cukup mengecek status & menarik data
// hasil dari DB, sama seperti script test Tahap 3 & 4.
async function callAction(pagePath, id, args) {
  return req(pagePath, {
    method: "POST",
    headers: { "next-action": id, Origin: BASE },
    body: await encodeReply(args),
  });
}

/** Tarik baris attempt siswa terbaru (berdasarkan submitted_at) untuk quiz. */
function latestAttempt(quizId, userId) {
  return db
    .prepare(
      "SELECT id, status, auto_score, score, mode AS passed, graded, essay_feedback FROM quiz_submissions WHERE quiz_id = ? AND user_id = ? ORDER BY submitted_at DESC, started_at DESC LIMIT 1"
    )
    .get(quizId, userId);
}

/** Ambil error teks dari payload RSC bila action mengembalikan { error }. */
async function actionError(res) {
  if (!res.ok) return `HTTP ${res.status}`;
  const text = await res.text();
  // Pesan error muncul sebagai teks nilainya di payload flight.
  const m = text.match(/"error":"([^"]+)"/);
  return m ? m[1] : null;
}

/** Ambil nilai kembalian action berupa object dari payload RSC. */
async function actionValue(res) {
  const text = await res.text();
  // Nilai non-string di-serialize sebagai baris "N:{...}" pada flight payload.
  const lines = text.split("\n").filter((l) => /^\d+:/.test(l));
  for (const l of lines) {
    const body = l.slice(l.indexOf(":") + 1);
    try {
      const v = JSON.parse(body);
      if (v && typeof v === "object" && !Array.isArray(v) && ("submissionId" in v || "score" in v || "error" in v)) {
        return v;
      }
    } catch {}
  }
  return null;
}

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
}

/**
 * React menyisipkan comment pemisah `<!-- -->` antar fragmen teks pada
 * HTML final (mis. "30<!-- --> menit" dan "KKM <!-- -->70"). Buang agar
 * pengecekan string tetap akurat.
 */
function cleanHtml(html) {
  return html.replace(/<!--\s*-->/g, "");
}

/** Ambil teks jawaban siswa untuk sebuah soal dari JSON answers. */
function answerOf(submissionId, questionId) {
  const row = db.prepare("SELECT answers FROM quiz_submissions WHERE id = ?").get(submissionId);
  if (!row) return null;
  const arr = JSON.parse(row.answers);
  const found = arr.find((a) => a.questionId === questionId);
  return found ? found.answer : null;
}

async function main() {
  const stamp = Date.now().toString(36);
  const courseTitle = `Kursus Quiz Uji ${stamp}`;
  const quizTitle = `Ujian Akhir ${stamp}`;
  const userId = db.prepare("SELECT id FROM users WHERE email = ?").get("siswa@lms.com").id;
  const instructorId = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get("instruktur@lms.com").id;

  // ============ INSTRUKTUR: buat kursus & quiz ============
  await login("instruktur@lms.com", "instruktur123");

  // Wajib: GET halaman lebih dulu agar Next.js mengcompile route & menulis
  // server-reference-manifest (berisi ID semua server action). Tanpa ini,
  // actionId() tidak menemukan action yang belum pernah dimuat browser.
  await req("/instruktur/kursus");
  await req("/instruktur/quiz");
  await req("/siswa/ujian");

  let form = new FormData();
  form.append("title", courseTitle);
  form.append("description", "Kursus untuk test otomatis Tahap 5.");
  let res = await callAction(
    "/instruktur/kursus",
    actionId("createCourseAction"),
    [null, form]
  );
  if (!res.ok) throw new Error(`Gagal membuat kursus: ${res.status}`);
  const courseId = db
    .prepare("SELECT id FROM courses WHERE title = ?")
    .get(courseTitle).id;

  form = new FormData();
  form.append("courseId", courseId);
  form.append("title", quizTitle);
  form.append("description", "Ujian untuk test otomatis Tahap 5.");
  form.append("durationMinutes", "30");
  form.append("passingScore", "70");
  res = await callAction("/instruktur/quiz", actionId("createQuizAction"), [null, form]);
  if (!res.ok) throw new Error(`Gagal membuat quiz: ${res.status}`);
  const quizId = db.prepare("SELECT id FROM quizzes WHERE title = ?").get(quizTitle).id;
  check("Instruktur membuat quiz", true, quizId.slice(0, 8));

  // ============ INSTRUKTUR: tambah soal PG + essay ============
  // Soal 1: PG 2 poin, jawaban benar index 1 (B)
  form = new FormData();
  form.append("quizId", quizId);
  form.append("type", "pilihan_ganda");
  form.append("question", `Apa ibu kota Kalimantan Timur? (${stamp})`);
  form.append("option_0", "Banjarmasin");
  form.append("option_1", "Samarinda");
  form.append("option_2", "Balikpapan");
  form.append("correctOptionIndex", "1");
  form.append("points", "2");
  res = await callAction("/instruktur/quiz/" + quizId, actionId("addQuestionAction"), [null, form]);
  if (!res.ok) throw new Error(`Gagal menambah soal PG: ${res.status}`);

  // Soal 2: essay 3 poin
  form = new FormData();
  form.append("quizId", quizId);
  form.append("type", "essay");
  form.append("question", `Jelaskan potensi UMKM di Samarinda. (${stamp})`);
  form.append("modelAnswer", "Potensi UMKM Samarinda meliputi kuliner, kerajinan, jasa.");
  form.append("points", "3");
  res = await callAction("/instruktur/quiz/" + quizId, actionId("addQuestionAction"), [null, form]);
  if (!res.ok) throw new Error(`Gagal menambah soal essay: ${res.status}`);

  const questions = db
    .prepare("SELECT id, type, points, order_index FROM quiz_questions WHERE quiz_id = ? ORDER BY order_index")
    .all(quizId);
  check(
    "Instruktur menambah 2 soal (PG + essay)",
    questions.length === 2 && questions[0].type === "pilihan_ganda" && questions[1].type === "essay",
    `soal: ${questions.map((q) => q.type).join(",")}`
  );
  check(
    "orderIndex soal urut 0,1 (tidak bentrok)",
    questions[0].order_index === 0 && questions[1].order_index === 1,
    `order = ${questions.map((q) => q.order_index).join(",")}`
  );
  const pgId = questions[0].id;
  const essayId = questions[1].id;

  // ============ HALAMAN MANAJEMEN INSTRUKTUR ============
  res = await req("/instruktur/quiz");
  check("GET /instruktur/quiz", res.status === 200, `status ${res.status}`);
  let html = await res.text();
  check("Quiz muncul di daftar quiz instruktur", cleanHtml(html).includes(quizTitle), quizTitle.slice(0, 20));

  res = await req(`/instruktur/quiz/${quizId}`);
  check("GET /instruktur/quiz/[quizId]", res.status === 200, `status ${res.status}`);
  html = await res.text();
  check("Soal PG & essay tampil di halaman detail", cleanHtml(html).includes("Banjarmasin") && cleanHtml(html).includes("Jelaskan potensi UMKM"));
  // Kunci jawaban & jawaban model hanya boleh muncul di sisi instruktur
  check("Kunci jawaban ditampilkan ke instruktur", cleanHtml(html).includes("Samarinda"));
  check(
    "Halaman detail punya tombol nilai essay (belum ada submission)",
    cleanHtml(html).includes("Belum ada yang mengerjakan"),
    "empty state submissions"
  );

  // ============ SISWA: halaman daftar ujian ============
  await login("siswa@lms.com", "siswa123");

  res = await req("/siswa/ujian");
  check("GET /siswa/ujian", res.status === 200, `status ${res.status}`);
  html = await res.text();
  check("Quiz muncul di daftar ujian siswa", cleanHtml(html).includes(quizTitle));
  check("Badges durasi & KKM tampil", cleanHtml(html).includes("30 menit") && cleanHtml(html).includes("KKM 70"));
  check("Status 'Belum dikerjakan'", cleanHtml(html).includes("Belum dikerjakan"));

  res = await req(`/siswa/ujian/${quizId}`);
  check("GET /siswa/ujian/[quizId]", res.status === 200, `status ${res.status}`);
  html = await res.text();
  // Kunci jawaban & jawaban model TIDAK boleh bocor ke halaman siswa.
  // CATATAN: teks opsi PG (mis. "Banjarmasin") wajib tampil — siswa harus
  // bisa membaca pilihannya. Yang dirahasiakan adalah penanda jawaban benar
  // (kunci "Samarinda" sebagai jawaban benar) dan jawaban model essay.
  check(
    "Kunci jawaban tidak bocor ke halaman siswa",
    !cleanHtml(html).includes("Jawaban benar") &&
      !cleanHtml(html).includes("Jawaban model") &&
      !cleanHtml(html).includes("Potensi UMKM Samarinda meliputi"),
    "no 'Jawaban benar' / 'Jawaban model' markers"
  );
  check("Identitas soal siswa hanya nomor & tipe", cleanHtml(html).includes("Soal 1") && cleanHtml(html).includes("Pilihan Ganda") && cleanHtml(html).includes("Essay"));

  // ============ SISWA: auto-save draft ============
  const startedAt = Date.now();
  res = await callAction("/siswa/ujian/" + quizId, actionId("saveQuizAnswersAction"), [
    quizId,
    { [pgId]: 1, [essayId]: "Samarinda punya banyak UMKM kuliner." },
  ]);
  if (!res.ok) throw new Error(`Gagal auto-save: ${res.status}`);
  const saveBody = await actionValue(res);
  const draftId = saveBody?.submissionId ?? latestAttempt(quizId, userId)?.id;
  check("Auto-save membuat draft submission", !!draftId, draftId?.slice(0, 8));

  let draftRow = db
    .prepare(
      "SELECT status, mode AS passed, graded FROM quiz_submissions WHERE id = ?"
    )
    .get(draftId);
  check(
    "Draft berstatus 'draft', belum dinilai",
    draftRow.status === "draft" && draftRow.graded === 0,
    `status=${draftRow.status} graded=${draftRow.graded}`
  );

  // Draft jawaban tercatat
  check(
    "Jawaban draft tersimpan di JSON answers",
    answerOf(draftId, pgId) === 1 && answerOf(draftId, essayId) === "Samarinda punya banyak UMKM kuliner.",
    `pg=${answerOf(draftId, pgId)}`
  );

  // Auto-save lanjut memperbarui draft yang sama (tidak bikin baris baru)
  await callAction("/siswa/ujian/" + quizId, actionId("saveQuizAnswersAction"), [
    quizId,
    { [pgId]: 1, [essayId]: "Jawaban diperpanjang." },
  ]);
  const draftCount = db
    .prepare("SELECT COUNT(*) c FROM quiz_submissions WHERE quiz_id = ? AND user_id = ? AND status = 'draft'")
    .get(quizId, userId).c;
  check("Auto-save kedua memperbarui draft (tetap 1 baris)", draftCount === 1, `drafts=${draftCount}`);

  // ============ SISWA: submit ujian ============
  res = await callAction("/siswa/ujian/" + quizId, actionId("submitQuizAction"), [
    quizId,
    { [pgId]: 1, [essayId]: "Samarinda punya banyak UMKM kuliner." },
    startedAt,
  ]);
  if (!res.ok) throw new Error(`Gagal submit ujian: ${res.status}`);
  const submitRes = await actionValue(res);
  check(
    "Submit mengembalikan skor auto-grade PG = 100 (2/2 poin)",
    submitRes?.score === 100,
    `score=${submitRes?.score}`
  );

  const attempt = latestAttempt(quizId, userId);
  check(
    "Attempt submitted: status=submitted, autoScore=100",
    attempt.status === "submitted" && attempt.auto_score === 100,
    `status=${attempt.status} autoScore=${attempt.auto_score}`
  );
  // Quiz ada essaynya → belum lulus sampai dinilai
  check(
    "Essay belum dinilai → graded=false & passed=false",
    attempt.graded === 0 && attempt.passed === 0,
    `graded=${attempt.graded} passed=${attempt.passed}`
  );
  check(
    "Submit memakai baris draft yang sama (id identik)",
    attempt.id === draftId,
    `${attempt.id.slice(0, 8)} vs draft ${draftId.slice(0, 8)}`
  );
  check("Jawaban benar PG tercatat di attempt", answerOf(attempt.id, pgId) === 1);

  // ============ ANTI-CHEAT: submit setelah waktu habis ditolak ============
  res = await callAction("/siswa/ujian/" + quizId, actionId("submitQuizAction"), [
    quizId,
    { [pgId]: 1, [essayId]: "Lama." },
    Date.now() - 31 * 60_000, // started 31 menit lalu, durasi 30 menit
  ]);
  const lateBody = await actionValue(res);
  check(
    "Submit setelah waktu habis ditolak server",
    lateBody?.error === "Waktu ujian sudah habis.",
    lateBody?.error ?? "(tidak ada error)"
  );

  // ============ HALAMAN HASIL SISWA ============
  res = await req("/siswa/ujian");
  html = await res.text();
  check(
    "Daftar ujian menampilkan 'Menunggu penilaian'",
    cleanHtml(html).includes("Menunggu penilaian"),
    "status badge attempt terbaru"
  );

  res = await req(`/siswa/ujian/${quizId}`);
  html = await res.text();
  check("Halaman ujian menampilkan riwayat attempt", cleanHtml(html).includes("Riwayat Pengerjaan"));

  // ============ INSTRUKTUR: halaman hasil & nilai essay ============
  await login("instruktur@lms.com", "instruktur123");

  res = await req(`/instruktur/quiz/${quizId}`);
  html = await res.text();
  check("Halaman detail menampilkan 1 submission", cleanHtml(html).includes("Hasil Siswa (1)"));
  check("Skor PG tampil di tabel hasil", cleanHtml(html).includes("100"));
  check("Status 'Menunggu penilaian' di tabel instruktur", cleanHtml(html).includes("Menunggu penilaian"));
  check("Tombol 'Nilai Essay' tampil", cleanHtml(html).includes("Nilai Essay"));

  // Tolak poin di luar batas (3 poin maks)
  form = new FormData();
  form.append("submissionId", attempt.id);
  form.append("questionId_0", essayId);
  form.append("points_0", "4");
  form.append("comment_0", "Poin di luar batas.");
  res = await callAction("/instruktur/quiz/" + quizId, actionId("gradeEssaysAction"), [null, form]);
  const overBody = await actionValue(res);
  check(
    "Poin essay di luar batas ditolak",
    overBody?.error === "Poin soal harus antara 0 dan 3.",
    overBody?.error ?? "(tidak ada error)"
  );

  // Nilai essay: 2 dari 3 poin
  form = new FormData();
  form.append("submissionId", attempt.id);
  form.append("questionId_0", essayId);
  form.append("points_0", "2");
  form.append("comment_0", "Jawaban baik, tapi kurang lengkap.");
  res = await callAction("/instruktur/quiz/" + quizId, actionId("gradeEssaysAction"), [null, form]);
  if (!res.ok) throw new Error(`Gagal menilai essay: ${res.status}`);

  // Skor akhir = (2 PG + 2 essay) / (2 + 3) * 100 = 80
  const graded = db
    .prepare(
      "SELECT score, mode AS passed, graded, essay_feedback FROM quiz_submissions WHERE id = ?"
    )
    .get(attempt.id);
  check(
    "Nilai akhir = (PG 2 + essay 2) / total 5 poin = 80",
    graded.score === 80,
    `score=${graded.score}`
  );
  check("graded=true setelah dinilai", graded.graded === 1, `graded=${graded.graded}`);
  check("Lulus (80 >= KKM 70)", graded.passed === 1, `passed=${graded.passed}`);

  const fb = JSON.parse(graded.essay_feedback);
  check(
    "Feedback essay tersimpan dengan poin & komentar",
    fb.length === 1 && fb[0].points === 2 && fb[0].comment === "Jawaban baik, tapi kurang lengkap.",
    JSON.stringify(fb)
  );

  // Halaman instruktur sekarang menampilkan Lulus
  res = await req(`/instruktur/quiz/${quizId}`);
  html = await res.text();
  check("Tabel hasil menampilkan 'Lulus' setelah penilaian", cleanHtml(html).includes("Lulus"));

  // Dashboard instruktur menampilkan quiz & tidak ada yang menunggu dinilai
  res = await req("/instruktur");
  html = await res.text();
  check("Dashboard instruktur menampilkan 'Quiz Dibuat: 1'", cleanHtml(html).includes("Quiz Dibuat"), "statistik quiz");
  // Kartu statistik menampilkan nilai SEBELUM label:
  // <p class="text-2xl font-bold">0</p><p ...>Menunggu Penilaian</p>
  check(
    "Dashboard instruktur: 'Menunggu Penilaian' = 0",
    />0<\/p>\s*<p[^>]*>Menunggu Penilaian</.test(cleanHtml(html).replace(/\s+/g, " ")),
    "statistik ungraded"
  );

  // ============ SISWA: lihat hasil setelah dinilai ============
  await login("siswa@lms.com", "siswa123");

  res = await req("/siswa/ujian");
  html = await res.text();
  check(
    "Daftar ujian menampilkan 'Skor terbaik: 80'",
    cleanHtml(html).includes("Skor terbaik: 80"),
    "badge skor"
  );

  res = await req(`/siswa/ujian/${quizId}`);
  html = await res.text();
  check("Riwayat menampilkan nilai 80", cleanHtml(html).includes("Nilai: 80"), "badge nilai attempt");
  check("Riwayat menampilkan status Lulus", cleanHtml(html).includes("Lulus"), "badgestatus attempt");

  // Dashboard siswa menampilkan jumlah ujian dikerjakan
  res = await req("/siswa");
  html = await res.text();
  check("Dashboard siswa menampilkan 'Ujian Dikerjakan'", cleanHtml(html).includes("Ujian Dikerjakan"), "statistik ujian");

  // ============ KEAMANAN: tamu & lintas peran ============
  const beforeCookies = cookies;
  cookies = "";
  res = await req("/siswa/ujian");
  check("Tamu ditolak di /siswa/ujian (redirect 307)", res.status === 307 || res.status === 401, `status ${res.status}`);
  res = await req("/instruktur/quiz");
  check("Tamu ditolak di /instruktur/quiz (redirect 307)", res.status === 307 || res.status === 401, `status ${res.status}`);
  cookies = beforeCookies;

  // Siswa mencoba akses halaman instruktur
  res = await req("/instruktur/quiz");
  check("Siswa ditolak di /instruktur/quiz", res.status !== 200, `status ${res.status}`);

  // ============ INSTRUKTUR: hapus soal & quiz ============
  await login("instruktur@lms.com", "instruktur123");

  res = await callAction(
    "/instruktur/quiz/" + quizId,
    actionId("deleteQuestionAction"),
    [essayId]
  );
  const qLeft = db.prepare("SELECT COUNT(*) c FROM quiz_questions WHERE quiz_id = ?").get(quizId).c;
  check("Instruktur menghapus soal essay", qLeft === 1, `sisa soal=${qLeft}`);

  res = await callAction("/instruktur/quiz", actionId("deleteQuizAction"), [quizId]);
  const gone = db.prepare("SELECT id FROM quizzes WHERE id = ?").get(quizId);
  check(
    "Instruktur menghapus quiz (row hilang dari DB)",
    !gone,
    `status action ${res.status}`
  );
  const orphanSubs = db
    .prepare("SELECT COUNT(*) c FROM quiz_submissions WHERE quiz_id = ?")
    .get(quizId).c;
  check("Submission ikut terhapus (cascade)", orphanSubs === 0, `sisa=${orphanSubs}`);

  // ============ RINGKASAN ============
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  if (failed.length > 0) {
    console.log("\nGAGAL:");
    for (const f of failed) console.log(`  ✗ ${f.name}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
