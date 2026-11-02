// Test E2E Tahap 3 — alur lengkap manajemen materi:
// instruktur buat kursus + materi (teks & PDF) → admin approve/reject →
// siswa hanya melihat materi yang disetujui.
//
// Memakai format request server action yang SAMA dengan browser:
// POST ke path halaman + header "next-action: <actionId>" +
// body = encodeReply([...args]) (multipart RSC).
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
  if (res.status !== 302 && res.status !== 200) throw new Error(`Login gagal: ${email} ${res.status}`);
}

/** Ambil ID action dari server-reference-manifest. */
function actionId(exportedName) {
  const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8"));
  for (const [id, entry] of Object.entries(manifest.node || {})) {
    if (entry && entry.exportedName === exportedName) return id;
  }
  throw new Error(`Action tidak ditemukan di manifest: ${exportedName}`);
}

/**
 * Panggil server action persis seperti browser: header next-action + body RSC.
 * `args` = daftar argumen bound.
 * encodeReply mengembalikan string (payload RSC) atau FormData (bila ada File/Blob).
 * Keduanya dikirim apa adanya — fetch menentukan content-type otomatis:
 * string → text/plain, FormData → multipart/form-data dengan boundary.
 */
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

function materialId(title) {
  const row = db.prepare("SELECT id FROM materials WHERE title = ?").get(title);
  if (!row) throw new Error(`Materi tidak ditemukan di DB: ${title}`);
  return row.id;
}

async function main() {
  const stamp = Date.now().toString(36);
  const courseTitle = `Kursus Uji ${stamp}`;
  const textMaterial = `Modul Pengantar ${stamp}`;
  const pdfMaterial = `Panduan PDF ${stamp}`;

  // ============ INSTRUKTUR: buat kursus ============
  await login("instruktur@lms.com", "instruktur123");

  // Warm-up halaman agar Next.js mengcompile route & menulis manifest
  await req("/instruktur/kursus");
  await req("/instruktur/materi");
  await req("/admin/materi");
  await req("/siswa/materi");

  let form = new FormData();
  form.append("title", courseTitle);
  form.append("description", "Kursus dari test otomatis Tahap 3.");
  let res = await callAction("/instruktur/kursus", actionId("createCourseAction"), [null, form]);
  check("POST createCourseAction (format browser)", res.status === 200, `status ${res.status}`);

  let html = await (await req("/instruktur/kursus")).text();
  check("Kursus tampil di /instruktur/kursus", html.includes(courseTitle));
  if (!html.includes(courseTitle)) {
    console.log(html.slice(0, 400));
    return;
  }

  const courseId = db
    .prepare("SELECT id FROM courses WHERE title = ?")
    .get(courseTitle)?.id;
  if (!courseId) {
    console.log("Gagal menemukan course id di DB.");
    return;
  }
  console.log(`  course id: ${courseId.slice(0, 8)}…`);

  // ============ INSTRUKTUR: buat materi teks ============
  form = new FormData();
  form.append("courseId", courseId);
  form.append("title", textMaterial);
  form.append("type", "teks");
  form.append("content", "Ini isi materi teks uji.");
  res = await callAction("/instruktur/materi", actionId("createMaterialAction"), [null, form]);
  check("POST createMaterialAction (teks)", res.status === 200, `status ${res.status}`);

  // ============ INSTRUKTUR: buat materi PDF ============
  // PDF minimal valid (header %PDF- + trailer) agar lolos validasi file.
  const pdfBytes = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
      "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
      "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]>>endobj\n" +
      "xref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n0\n%%EOF\n"
  );
  const pdfFile = new File([pdfBytes], `uji-${stamp}.pdf`, { type: "application/pdf" });

  form = new FormData();
  form.append("courseId", courseId);
  form.append("title", pdfMaterial);
  form.append("type", "pdf");
  form.append("content", "Deskripsi singkat PDF uji.");
  form.append("file", pdfFile);
  res = await callAction("/instruktur/materi", actionId("createMaterialAction"), [null, form]);
  check("POST createMaterialAction (pdf)", res.status === 200, `status ${res.status}`);

  // ============ ADMIN: melihat materi pending ============
  await login("admin@lms.com", "admin123");
  html = await (await req("/admin/materi")).text();
  check("Materi pending muncul di /admin/materi", html.includes("Menunggu Persetujuan") && html.includes(textMaterial));

  // Tolak materi PDF
  const rejectId = actionId("rejectMaterialAction");
  console.log(`  reject action id: ${rejectId}`);
  res = await callAction("/admin/materi", rejectId, [
    materialId(pdfMaterial),
    "Isi PDF tidak sesuai standar kurikulum.",
  ]);
  check("POST rejectMaterialAction", res.status === 200, `status ${res.status}`);

  // Setujui materi teks
  const approveId = actionId("approveMaterialAction");
  console.log(`  approve action id: ${approveId}`);
  res = await callAction("/admin/materi", approveId, [materialId(textMaterial)]);
  check("POST approveMaterialAction", res.status === 200, `status ${res.status}`);

  html = await (await req("/admin/materi")).text();
  check("Materi ditandai ditolak di /admin/materi", /Ditolak/i.test(html));

  // ============ SISWA: hanya materi approved ============
  await login("siswa@lms.com", "siswa123");
  html = await (await req("/siswa/materi")).text();
  check("Materi approved terlihat siswa", html.includes(textMaterial));
  check("Materi rejected tidak terlihat siswa", !html.includes(pdfMaterial));

  // Detail materi approved bisa dibuka
  res = await req(`/siswa/materi/${materialId(textMaterial)}`);
  check("GET /siswa/materi/[id] materi approved", res.status === 200, `status ${res.status}`);

  // Notifikasi ke admin & instruktur tersimpan
  const notifs = db
    .prepare("SELECT title FROM notifications ORDER BY created_at DESC LIMIT 5")
    .all()
    .map((n) => n.title);
  check("Notifikasi tersimpan", notifs.some((n) => n.includes("Materi")), JSON.stringify(notifs));

  console.log("\nTotal:", results.length, "Gagal:", results.filter((x) => !x.ok).length);
  if (results.some((x) => !x.ok)) process.exitCode = 1;
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
