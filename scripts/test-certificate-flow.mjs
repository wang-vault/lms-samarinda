// Test E2E Tahap 6 — alur sertifikat:
// siswa lulus ujian (auto-grade PG) → sertifikat otomatis diterbitkan +
// notifikasi → PDF valid → hak akses → jalur essay (nilai instruktur →
// sertifikat diterbitkan setelah lulus) → idempotensi (tidak duplikat) →
// halaman siswa & instruktur menampilkan sertifikat.
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

async function callAction(pagePath, id, args) {
  return req(pagePath, {
    method: "POST",
    headers: { "next-action": id, Origin: BASE },
    body: await encodeReply(args),
  });
}

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
}

/**
 * React menyisipkan comment pemisah `<!-- -->` antar fragmen teks pada
 * HTML final. Buang agar pengecekan string tetap akurat.
 */
function cleanHtml(html) {
  return html.replace(/<!--\s*-->/g, "");
}

/** Sertifikat untuk sebuah submission (atau null bila belum ada). */
function certForSubmission(submissionId) {
  return db
    .prepare(
      "SELECT id, certificate_number, score, user_id FROM certificates WHERE quiz_submission_id = ?"
    )
    .get(submissionId);
}

/** Jumlah sertifikat milik seorang siswa. */
function certCount(userId) {
  return db
    .prepare("SELECT COUNT(*) c FROM certificates WHERE user_id = ?")
    .get(userId).c;
}

/** Attempt submitted terbaru seorang siswa untuk quiz. */
function latestAttempt(quizId, userId) {
  return db
    .prepare(
      "SELECT id, mode AS passed, graded FROM quiz_submissions WHERE quiz_id = ? AND user_id = ? AND status = 'submitted' ORDER BY submitted_at DESC LIMIT 1"
    )
    .get(quizId, userId);
}

async function main() {
  const stamp = Date.now().toString(36);
  const userId = db.prepare("SELECT id FROM users WHERE email = ?").get("siswa@lms.com").id;
  const otherSiswa = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get("siswa2@lms.com");

  // ============ INSTRUKTUR: buat kursus + 2 quiz (PG-only & PG+essay) ============
  await login("instruktur@lms.com", "instruktur123");

  // Wajib: GET halaman lebih dulu agar Next.js mengcompile route & menulis
  // server-reference-manifest (berisi ID semua server action).
  await req("/instruktur/kursus");
  await req("/instruktur/quiz");
  await req("/siswa/ujian");
  await req("/siswa/sertifikat");
  await req("/instruktur/sertifikat");

  let form = new FormData();
  const courseTitle = `Kursus Sertifikat Uji ${stamp}`;
  form.append("title", courseTitle);
  form.append("description", "Kursus untuk test otomatis Tahap 6.");
  let res = await callAction(
    "/instruktur/kursus",
    actionId("createCourseAction"),
    [null, form]
  );
  if (!res.ok) throw new Error(`Gagal membuat kursus: ${res.status}`);
  const courseId = db
    .prepare("SELECT id FROM courses WHERE title = ?")
    .get(courseTitle).id;

  // Quiz A: murni pilihan ganda (auto-graded saat submit)
  const quizATitle = `Ujian PG Sertifikat ${stamp}`;
  form = new FormData();
  form.append("courseId", courseId);
  form.append("title", quizATitle);
  form.append("description", "Ujian PG untuk test sertifikat.");
  form.append("durationMinutes", "30");
  form.append("passingScore", "70");
  res = await callAction("/instruktur/quiz", actionId("createQuizAction"), [null, form]);
  if (!res.ok) throw new Error(`Gagal membuat quiz A: ${res.status}`);
  const quizAId = db.prepare("SELECT id FROM quizzes WHERE title = ?").get(quizATitle).id;

  // Soal quiz A: PG 10 poin, jawaban benar index 0
  form = new FormData();
  form.append("quizId", quizAId);
  form.append("type", "pilihan_ganda");
  form.append("question", `Apa ibu kota Kalimantan Timur? (${stamp})`);
  form.append("option_0", "Samarinda");
  form.append("option_1", "Banjarmasin");
  form.append("option_2", "Balikpapan");
  form.append("correctOptionIndex", "0");
  form.append("points", "10");
  res = await callAction(
    `/instruktur/quiz/${quizAId}`,
    actionId("addQuestionAction"),
    [null, form]
  );
  if (!res.ok) throw new Error(`Gagal menambah soal quiz A: ${res.status}`);

  // Quiz B: PG + essay (graded setelah instruktur menilai)
  const quizBTitle = `Ujian Essay Sertifikat ${stamp}`;
  form = new FormData();
  form.append("courseId", courseId);
  form.append("title", quizBTitle);
  form.append("description", "Ujian essay untuk test sertifikat.");
  form.append("durationMinutes", "30");
  form.append("passingScore", "70");
  res = await callAction("/instruktur/quiz", actionId("createQuizAction"), [null, form]);
  if (!res.ok) throw new Error(`Gagal membuat quiz B: ${res.status}`);
  const quizBId = db.prepare("SELECT id FROM quizzes WHERE title = ?").get(quizBTitle).id;

  // Soal quiz B: PG 10 poin + essay 10 poin
  form = new FormData();
  form.append("quizId", quizBId);
  form.append("type", "pilihan_ganda");
  form.append("question", `Ibu kota Kalimantan Timur adalah? (${stamp})`);
  form.append("option_0", "Samarinda");
  form.append("option_1", "Banjarmasin");
  form.append("correctOptionIndex", "0");
  form.append("points", "10");
  res = await callAction(
    `/instruktur/quiz/${quizBId}`,
    actionId("addQuestionAction"),
    [null, form]
  );
  if (!res.ok) throw new Error(`Gagal menambah soal PG quiz B: ${res.status}`);

  form = new FormData();
  form.append("quizId", quizBId);
  form.append("type", "essay");
  form.append("question", `Jelaskan potensi UMKM di Samarinda. (${stamp})`);
  form.append("modelAnswer", "Potensi UMKM Samarinda meliputi kuliner, kerajinan, jasa.");
  form.append("points", "10");
  res = await callAction(
    `/instruktur/quiz/${quizBId}`,
    actionId("addQuestionAction"),
    [null, form]
  );
  if (!res.ok) throw new Error(`Gagal menambah soal essay quiz B: ${res.status}`);

  const quizBEssay = db
    .prepare("SELECT id FROM quiz_questions WHERE quiz_id = ? AND type = 'essay'")
    .get(quizBId);

  // ============ SISWA: kerjakan quiz A (semua jawaban benar) ============
  await login("siswa@lms.com", "siswa123");

  const quizAQ = db
    .prepare("SELECT id FROM quiz_questions WHERE quiz_id = ? AND type = 'pilihan_ganda'")
    .get(quizAId);

  const beforeCount = certCount(userId);

  res = await callAction("/siswa/ujian/" + quizAId, actionId("submitQuizAction"), [
    quizAId,
    { [quizAQ.id]: 0 }, // jawaban benar
    Date.now(),
  ]);
  if (!res.ok) throw new Error(`Gagal submit quiz A: ${res.status}`);

  const attemptA = latestAttempt(quizAId, userId);
  const certA = certForSubmission(attemptA.id);
  check(
    "Siswa lulus ujian PG → sertifikat diterbitkan otomatis",
    !!certA,
    certA ? certA.certificate_number : "(tidak ada)"
  );
  check(
    "Skor di sertifikat = skor attempt",
    !!certA && certA.score === 100,
    `score = ${certA?.score}`
  );
  check(
    "Sertifikat dimiliki siswa yang bersangkutan",
    !!certA && certA.user_id === userId,
    certA?.user_id.slice(0, 8)
  );
  check(
    "Idempoten: jumlah sertifikat bertambah tepat 1",
    certCount(userId) === beforeCount + 1,
    `sebelum ${beforeCount} → sesudah ${certCount(userId)}`
  );

  // Format nomor sertifikat: SERT-YYYYMMDD-XXXXXX
  check(
    "Format nomor sertifikat SERT-YYYYMMDD-XXXXXX",
    /^SERT-\d{8}-[A-Z0-9]{6}$/.test(certA?.certificate_number ?? ""),
    certA?.certificate_number ?? ""
  );

  // Notifikasi diterima siswa
  const notif = db
    .prepare(
      "SELECT title, type FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1"
    )
    .get(userId);
  check(
    "Notifikasi 'Sertifikat diterbitkan' masuk ke siswa",
    !!notif && notif.title === "Sertifikat diterbitkan" && notif.type === "success",
    notif ? `${notif.title} (${notif.type})` : "(tidak ada)"
  );

  // ============ SISWA: kerjakan quiz B (essay perlu penilaian) ============
  const quizBPG = db
    .prepare("SELECT id FROM quiz_questions WHERE quiz_id = ? AND type = 'pilihan_ganda'")
    .get(quizBId);

  res = await callAction("/siswa/ujian/" + quizBId, actionId("submitQuizAction"), [
    quizBId,
    { [quizBPG.id]: 0, [quizBEssay.id]: "Potensi UMKM Samarinda meliputi kuliner dan jasa." },
    Date.now(),
  ]);
  if (!res.ok) throw new Error(`Gagal submit quiz B: ${res.status}`);

  const attemptB = latestAttempt(quizBId, userId);
  // Quiz B ada essay-nya: belum graded, belum lulus, belum dapat sertifikat.
  check(
    "Quiz essay: sertifikat BELUM diterbitkan sebelum dinilai",
    !certForSubmission(attemptB.id),
    `(graded=${attemptB.graded})`
  );

  // ============ HALAMAN SISWA ============
  res = await req("/siswa/sertifikat");
  check("GET /siswa/sertifikat", res.status === 200, `status ${res.status}`);
  let html = cleanHtml(await res.text());
  check(
    "Sertifikat muncul di halaman siswa",
    html.includes(certA.certificate_number),
    certA.certificate_number
  );
  check(
    "Tautan PDF sertifikat tampil di halaman siswa",
    html.includes(`/api/sertifikat/${certA.id}/pdf`),
    "link Lihat/Unduh PDF"
  );
  check(
    "Quiz essay yang belum lulus TIDAK muncul di halaman siswa",
    !html.includes(quizBTitle),
    `(hanya sertifikat yang sudah terbit)`
  );
  check(
    "Statistik total sertifikat tampil",
    html.includes("Total Sertifikat"),
    "stat card"
  );

  // ============ UNDUH PDF ============
  res = await req(`/api/sertifikat/${certA.id}/pdf`);
  check("GET PDF sertifikat (200)", res.status === 200, `status ${res.status}`);
  check(
    "Content-Type application/pdf",
    res.headers.get("content-type") === "application/pdf",
    res.headers.get("content-type") ?? "(tidak ada)"
  );
  check(
    "Content-Disposition inline + nama file",
    (res.headers.get("content-disposition") ?? "").startsWith(
      `inline; filename="sertifikat-${certA.certificate_number}.pdf"`
    ),
    res.headers.get("content-disposition") ?? "(tidak ada)"
  );
  const pdfBody = Buffer.from(await res.arrayBuffer());
  check(
    "Isi response diawali magic %PDF-",
    pdfBody.subarray(0, 5).toString("latin1") === "%PDF-",
    pdfBody.subarray(0, 5).toString("latin1")
  );
  check(
    "Isi response diakhiri %%EOF",
    pdfBody.subarray(-6).toString("latin1").includes("%%EOF"),
    `"${pdfBody.subarray(-6).toString("latin1")}"`
  );
  // Struktur internal: harus ada tabel xref & trailer.
  const pdfText = pdfBody.toString("latin1");
  check(
    "Struktur PDF valid: xref & trailer ada",
    pdfText.includes("xref") && pdfText.includes("trailer") && pdfText.includes("startxref"),
    "xref/trailer/startxref"
  );

  // -------- Verifikasi internal struktur PDF (offset xref harus akurat) --------
  // PDFSpecification: startxref menunjuk byte awal tabel xref, dan setiap entri
  // xref menunjuk byte awal objek yang dirujuk. Bila offset salah, viewer
  // menampilkan "file rusak".
  {
    const startxrefMatch = pdfText.match(/startxref\s+(\d+)/);
    const xrefIdx = pdfText.indexOf("\nxref") + 1; // byte awal baris "xref"
    check(
      "startxref menunjuk offset tabel xref yang benar",
      !!startxrefMatch && xrefIdx > 0 && Number(startxrefMatch[1]) === xrefIdx,
      startxrefMatch
        ? `startxref=${startxrefMatch[1]} vs xref di byte ${xrefIdx}`
        : "(tidak ada startxref)"
    );

    // Peta nomor objek → offset kemunculan "\nN 0 obj".
    const objOffsets = new Map(
      [...pdfText.matchAll(/\n(\d+) 0 obj/g)].map((m) => [
        Number(m[1]),
        m.index + 1,
      ])
    );

    // Parse header subsection ("xref\n<first> <count>\n") lalu entri 20-byte.
    let entriesOk = true;
    let entriesChecked = 0;
    const xrefBody = pdfText.slice(xrefIdx);
    const headerMatch = xrefBody.match(/^xref\n(\d+) (\d+)\n/);
    if (headerMatch) {
      const firstObj = Number(headerMatch[1]);
      const count = Number(headerMatch[2]);
      const entryLines = xrefBody
        .slice(headerMatch[0].length)
        .split("\n")
        .slice(0, count);
      for (let i = 0; i < count; i++) {
        const line = entryLines[i];
        if (!line || line[17] !== "n") continue; // lewati entri "free"
        const declared = Number(line.slice(0, 10));
        const actual = objOffsets.get(firstObj + i);
        if (actual === undefined || actual !== declared) entriesOk = false;
        entriesChecked++;
      }
    } else {
      entriesOk = false;
    }
    check(
      "Setiap entri xref menunjuk offset objek yang benar",
      entriesOk,
      `${entriesChecked} entri in-use diperiksa`
    );
  }

  // MediaBox A4 lanskap & panjang stream sesuai /Length.
  check(
    "Ukuran halaman A4 lanskap (842 x 595 pt)",
    pdfText.includes("/MediaBox [0 0 842 595]"),
    (pdfText.match(/\/MediaBox \[[^\]]+\]/) || ["(tidak ada)"])[0]
  );
  {
    const lenMatch = pdfText.match(/\/Length (\d+)/);
    // potong stream dengan index, BUKAN split("stream\n") — substring "stream\n"
    // juga muncul di dalam "endstream", yang membuat hasil tergabung "\nend".
    const sIdx = pdfText.indexOf("stream\n") + "stream\n".length;
    const streamBody = pdfText.slice(sIdx, pdfText.indexOf("\nendstream"));
    check(
      "Panjang content stream sesuai /Length",
      !!lenMatch && Buffer.byteLength(streamBody, "latin1") === Number(lenMatch[1]),
      lenMatch
        ? `/Length=${lenMatch[1]} vs aktual=${Buffer.byteLength(streamBody, "latin1")}`
        : "(tidak ada /Length)"
    );
  }
  check(
    "PDF memuat nama siswa & judul ujian",
    pdfText.includes("Sari Siswa") && pdfText.includes(quizATitle),
    "teks sertifikat"
  );
  check(
    "PDF berukuran wajar (> 1 KB)",
    pdfBody.length > 1024,
    `${pdfBody.length} byte`
  );

  // ============ KEAMANAN: akses ditolak ============
  // Tamu (tidak login)
  const savedCookies = cookies;
  cookies = "";
  res = await req(`/api/sertifikat/${certA.id}/pdf`);
  check("Tamu ditolak (401) saat unduh PDF", res.status === 401, `status ${res.status}`);
  cookies = savedCookies;

  // Siswa lain
  if (otherSiswa) {
    await login("siswa2@lms.com", "siswa2123");
    res = await req(`/api/sertifikat/${certA.id}/pdf`);
    check(
      "Siswa lain ditolak (403) saat unduh PDF",
      res.status === 403,
      `status ${res.status}`
    );
    // Halaman siswa lain kosong (tidak menampilkan sertifikat Sari)
    res = await req("/siswa/sertifikat");
    const otherHtml = cleanHtml(await res.text());
    check(
      "Sertifikat Sari TIDAK muncul di halaman siswa lain",
      !otherHtml.includes(certA.certificate_number),
      "hanya sertifikat milik sendiri"
    );
  } else {
    console.log("SKIP  uji siswa kedua (siswa2@lms.com tidak ada di DB)");
  }

  // Sertifikat yang tidak ada → 404
  await login("siswa@lms.com", "siswa123");
  res = await req(`/api/sertifikat/nonexistent-${stamp}/pdf`);
  check("Sertifikat tidak ditemukan → 404", res.status === 404, `status ${res.status}`);

  // ============ INSTRUKTUR: nilai essay quiz B (lulus) ============
  await login("instruktur@lms.com", "instruktur123");

  form = new FormData();
  form.append("submissionId", attemptB.id);
  form.append("questionId_0", quizBEssay.id);
  form.append("points_0", "9");
  form.append("comment_0", "Jawaban cukup baik.");
  res = await callAction(
    `/instruktur/quiz/${quizBId}`,
    actionId("gradeEssaysAction"),
    [null, form]
  );
  if (!res.ok) throw new Error(`Gagal menilai essay: ${res.status}`);

  const attemptB2 = latestAttempt(quizBId, userId);
  const certB = certForSubmission(attemptB.id);
  check(
    "Nilai essay lulus → sertifikat diterbitkan",
    !!certB && attemptB2.graded === 1 && attemptB2.passed === 1,
    certB ? certB.certificate_number : "(tidak ada)"
  );

  // Idempotensi: panggil penerbitan ulang via grading kedua kalinya tidak
  // menambah sertifikat baru untuk submission yang sama.
  form = new FormData();
  form.append("submissionId", attemptB.id);
  form.append("questionId_0", quizBEssay.id);
  form.append("points_0", "9");
  form.append("comment_0", "Jawaban cukup baik.");
  await callAction(`/instruktur/quiz/${quizBId}`, actionId("gradeEssaysAction"), [null, form]);
  check(
    " Nilai ulang tidak membuat sertifikat duplikat",
    db
      .prepare("SELECT COUNT(*) c FROM certificates WHERE quiz_submission_id = ?")
      .get(attemptB.id).c === 1,
    `jumlah sertifikat untuk submission ini = 1`
  );

  // ============ INSTRUKTUR: siswa gagal ujian → tidak dapat sertifikat ============
  // Quiz A kembali dikerjakan dengan jawaban salah → skor 0, tidak lulus.
  await login("siswa@lms.com", "siswa123");
  res = await callAction("/siswa/ujian/" + quizAId, actionId("submitQuizAction"), [
    quizAId,
    { [quizAQ.id]: 1 }, // jawaban salah
    Date.now(),
  ]);
  if (!res.ok) throw new Error(`Gagal submit ulang quiz A: ${res.status}`);

  const attemptAFail = latestAttempt(quizAId, userId);
  check(
    "Siswa tidak lulus → tidak ada sertifikat baru",
    !certForSubmission(attemptAFail.id),
    `(attempt ke-2, lulus=${attemptAFail.passed})`
  );

  // ============ HALAMAN INSTRUKTUR ============
  await login("instruktur@lms.com", "instruktur123");
  res = await req("/instruktur/sertifikat");
  check("GET /instruktur/sertifikat", res.status === 200, `status ${res.status}`);
  html = cleanHtml(await res.text());
  check(
    "Sertifikat muncul di halaman instruktur",
    html.includes(certA.certificate_number),
    certA.certificate_number
  );
  check(
    "Nama siswa penerima sertifikat tampil",
    html.includes("Sari Siswa"),
    "kolom Siswa"
  );
  check(
    "Sertifikat dikelompokkan per kursus",
    html.includes(courseTitle),
    courseTitle.slice(0, 30)
  );
  check(
    "Tautan PDF tampil di halaman instruktur",
    html.includes(`/api/sertifikat/${certA.id}/pdf`),
    "link Lihat PDF"
  );

  // Instruktur bisa membuka PDF sertifikat siswanya
  res = await req(`/api/sertifikat/${certA.id}/pdf`);
  check(
    "Instruktur bisa mengunduh PDF sertifikat siswanya",
    res.status === 200 && res.headers.get("content-type") === "application/pdf",
    `status ${res.status}`
  );

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
