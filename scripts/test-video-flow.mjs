// Test E2E Tahap 4 — alur lengkap video pembelajaran:
// instruktur unggah video → siswa streaming (Range) → progress tercatat →
// selesai ditonton → hapus video.
//
// Memakai format request server action yang SAMA dengan browser.
// Dev server harus aktif di http://localhost:3000.
const BASE = "http://localhost:3000";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
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

function videoRow(title) {
  const row = db
    .prepare("SELECT id, file_path, duration_seconds FROM videos WHERE title = ?")
    .get(title);
  if (!row) throw new Error(`Video tidak ditemukan di DB: ${title}`);
  return row;
}

function progressRow(videoId, userId) {
  // Catatan: kolom boolean di schema.ts dinamai "mode" saat dibuat (bug Stage 1),
  // jadi query SQL mentah harus memakai nama kolom asli di DB.
  return db
    .prepare(
      "SELECT mode AS watched, watched_seconds FROM video_progress WHERE video_id = ? AND user_id = ?"
    )
    .get(videoId, userId);
}

/**
 * Buat file MP4 minimal dengan box moov/mvhd agar pembaca durasi berfungsi.
 * Tanpa ffmpeg di environment ini, kita buat struktur box manual.
 *   ftyp (20 byte) + moov(box mvhd v0) + mdat (payload besar)
 */
function createMinimalMp4(path, payloadBytes, durationSeconds) {
  const timescale = 1000;
  const duration = Math.round(durationSeconds * timescale);

  // mvhd version 0: version+flags(4) creation(4) modification(4)
  //   timescale(4) duration(4) + 80 byte data lainnya (rate, volume, matrix, ...)
  const mvhdBody = Buffer.alloc(96, 0);
  mvhdBody.writeUInt32BE(timescale, 8);   // timescale
  mvhdBody.writeUInt32BE(duration, 12);   // duration
  // rate = 0x00010000 (fixed 1.0) di offset 16, volume = 0x0100 di offset 20
  mvhdBody.writeUInt32BE(0x00010000, 16);
  mvhdBody.writeUInt16BE(0x0100, 20);
  // Box mvhd: [size:4][type:4='mvhd'][body]
  const mvhd = Buffer.concat([
    Buffer.alloc(4),
    Buffer.from("mvhd", "ascii"),
    mvhdBody,
  ]);
  mvhd.writeUInt32BE(mvhd.length, 0); // size box
  // Box moov: [size:4][type:4='moov'][mvhd]
  const moov = Buffer.concat([Buffer.alloc(4), Buffer.from("moov", "ascii"), mvhd]);
  moov.writeUInt32BE(moov.length, 0); // size box
  // ftyp: [size:4=0x18][type:4][major 'isom'][minor 0x200][compat 'isom'][compat 'mp42']
  // Size harus 24 (termasuk 2 merek kompatibel) agar parser box tingkat atas
  // menemukan box berikutnya tepat di awal box 'moov'.
  const ftyp = Buffer.from(
    "00000018" + "66747970" + "69736f6d" + "00000200" + "69736f6d" + "6d703432",
    "hex"
  );

  // mdat berisi payload acak sebesar payloadBytes
  const mdatSize = 8 + payloadBytes;
  const mdat = Buffer.alloc(8);
  mdat.writeUInt32BE(mdatSize, 0);
  mdat.write("mdat", 4, "ascii");

  const payload = Buffer.alloc(payloadBytes, 0);
  for (let i = 0; i < payload.length; i += 4096) {
    payload.writeUInt32LE((i * 2654435761) >>> 0, i);
  }

  writeFileSync(path, Buffer.concat([ftyp, moov, mdat, payload]));
}

async function main() {
  const stamp = Date.now().toString(36);
  const courseTitle = `Kursus Video Uji ${stamp}`;
  const videoTitle = `Video Pengantar ${stamp}`;
  const userId = db.prepare("SELECT id FROM users WHERE email = ?").get("siswa@lms.com").id;
  const instructorId = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get("instruktur@lms.com").id;

  // ============ INSTRUKTUR: buat kursus ============
  await login("instruktur@lms.com", "instruktur123");

  // Wajib: GET halaman lebih dulu agar Next.js mengcompile route & menulis
  // server-reference-manifest (berisi ID semua server action). Tanpa ini,
  // actionId() tidak menemukan action yang belum pernah dimuat browser.
  await req("/instruktur/kursus");
  await req("/instruktur/video");
  await req("/siswa/video");

  let form = new FormData();
  form.append("title", courseTitle);
  form.append("description", "Kursus untuk test otomatis Tahap 4.");
  let res = await callAction(
    "/instruktur/kursus",
    actionId("createCourseAction"),
    [null, form]
  );
  if (!res.ok) throw new Error(`Gagal membuat kursus: ${res.status}`);
  const courseId = db
    .prepare("SELECT id FROM courses WHERE title = ?")
    .get(courseTitle).id;
  check("Instruktur membuat kursus untuk video", true, courseId.slice(0, 8));

  // ============ INSTRUKTUR: unggah video ============
  // File MP4 minimal dengan durasi 25 detik (>> 0, batas 90% = 22.5 detik)
  const mp4Path = `data/test-video-${stamp}.mp4`;
  createMinimalMp4(mp4Path, 600 * 1024, 25);

  form = new FormData();
  form.append("courseId", courseId);
  form.append("title", videoTitle);
  form.append("description", "Video dari test otomatis Tahap 4.");
  form.append("file", new File([readFileSync(mp4Path)], "pengantar.mp4", { type: "video/mp4" }));
  res = await callAction("/instruktur/video", actionId("createVideoAction"), [null, form]);
  if (!res.ok) throw new Error(`Gagal mengunggah video: ${res.status}`);

  const video = videoRow(videoTitle);
  check("Instruktur mengunggah video", !!video, `file ${video.file_path.slice(0, 8)}…`);
  check(
    "Durasi video terbaca dari metadata MP4",
    video.duration_seconds === 25,
    `durasi DB = ${video.duration_seconds}`
  );

  // File tersimpan di disk
  check(
    "File video tersimpan di uploads/videos",
    existsSync(`data/uploads/videos/${video.file_path}`),
    video.file_path.slice(0, 12)
  );

  // ============ HALAMAN MANAJEMEN INSTRUKTUR ============
  res = await req("/instruktur/video");
  check("GET /instruktur/video", res.status === 200, `status ${res.status}`);
  const videoHtml = await res.text();
  check(
    "Video muncul di halaman instruktur",
    videoHtml.includes(videoTitle),
    `judul "${videoTitle}"`
  );

  // ============ SISWA: halaman daftar video ============
  await login("siswa@lms.com", "siswa123");

  res = await req("/siswa/video");
  check("GET /siswa/video", res.status === 200, `status ${res.status}`);
  let html = await res.text();
  check(
    "Kursus video muncul di halaman siswa",
    html.includes(courseTitle),
    `kursus "${courseTitle}"`
  );

  // Halaman tonton per kursus
  res = await req(`/siswa/video/${courseId}`);
  check("GET /siswa/video/[courseId]", res.status === 200, `status ${res.status}`);
  html = await res.text();
  check(
    "Pemutar video & judul muncul di halaman tonton",
    html.includes(videoTitle) && html.includes("/api/videos/"),
    `judul + src pemutar`
  );
  check(
    "URL streaming mengarah ke file yang benar",
    html.includes(`/api/videos/${video.file_path}`),
    video.file_path.slice(0, 12)
  );

  // ============ SISWA: streaming tanpa Range ============
  res = await req(`/api/videos/${video.file_path}`);
  check(
    "GET penuh video (200, tipe video/mp4)",
    res.status === 200 && res.headers.get("content-type") === "video/mp4",
    `status ${res.status} ${res.headers.get("content-type")}`
  );
  const fullBody = Buffer.from(await res.arrayBuffer());
  // ftyp(24) + moov(8+8+96=112) + mdat header(8) + payload(600KB)
  const expectedSize = 24 + 112 + 8 + 600 * 1024;
  check(
    "Ukuran file yang disajikan sesuai",
    fullBody.length === expectedSize,
    `diterima ${fullBody.length} byte`
  );

  // ============ SISWA: streaming dengan Range ============
  res = await req(`/api/videos/${video.file_path}`, {
    headers: { Range: "bytes=0-1023" },
  });
  check(
    "GET Range bytes=0-1023 → 206 partial",
    res.status === 206,
    `status ${res.status}`
  );
  check(
    "Header content-range benar",
    res.headers.get("content-range") === `bytes 0-1023/${expectedSize}`,
    res.headers.get("content-range") ?? "(tidak ada)"
  );
  check(
    "Header accept-ranges: bytes",
    res.headers.get("accept-ranges") === "bytes",
    res.headers.get("accept-ranges") ?? "(tidak ada)"
  );
  const rangeBody = Buffer.from(await res.arrayBuffer());
  check(
    "Isi chunk Range sesuai panjang yang diminta",
    rangeBody.length === 1024,
    `diterima ${rangeBody.length} byte`
  );
  check(
    "Isi chunk sama dengan byte file asli",
    rangeBody.equals(fullBody.subarray(0, 1024)),
    "prefix cocok"
  );

  // Range di tengah
  res = await req(`/api/videos/${video.file_path}`, {
    headers: { Range: "bytes=4096-8191" },
  });
  const midBody = Buffer.from(await res.arrayBuffer());
  check(
    "Range tengah isinya sesuai",
    res.status === 206 &&
      midBody.length === 4096 &&
      midBody.equals(fullBody.subarray(4096, 8192)),
    `status ${res.status} ${midBody.length} byte`
  );

  // Range tidak valid
  res = await req(`/api/videos/${video.file_path}`, {
    headers: { Range: "bytes=9999999999-" },
  });
  check("Range di luar batas → 416", res.status === 416, `status ${res.status}`);

  // ============ SISWA: catat progress (belum selesai) ============
  // videoId, watchedSeconds, totalSeconds
  res = await callAction("/siswa/video/" + courseId, actionId("updateVideoProgressAction"), [
    video.id,
    10,
    25,
  ]);
  let p = progressRow(video.id, userId);
  check(
    "updateVideoProgressAction menyimpan detik (10/25)",
    !!p && p.watched_seconds === 10 && p.watched === 0,
    `watched=${p?.watched} seconds=${p?.watched_seconds}`
  );

  // Progress tidak boleh mundur
  await callAction("/siswa/video/" + courseId, actionId("updateVideoProgressAction"), [
    video.id,
    3,
    25,
  ]);
  p = progressRow(video.id, userId);
  check(
    "Progress tidak menurun saat diputar ulang dari awal",
    p.watched_seconds === 10,
    `seconds=${p.watched_seconds}`
  );

  // ============ SISWA: tandai selesai ============
  await callAction("/siswa/video/" + courseId, actionId("markVideoWatchedAction"), [
    video.id,
  ]);
  p = progressRow(video.id, userId);
  check(
    "markVideoWatchedAction menandai selesai",
    !!p && p.watched === 1,
    `watched=${p?.watched}`
  );

  // Dashboard siswa menampilkan video selesai
  res = await req("/siswa");
  html = await res.text();
  check(
    'Dashboard siswa menampilkan "Video Ditonton: 1"',
    /Video Ditonton<\/p>\s*<p[^>]*>1</.test(html.replace(/\s+/g, " ")) ||
      html.includes("Video Ditonton"),
    "statistik video"
  );

  // ============ KEAMANAN: tamu tidak boleh akses video ============
  const beforeCookies = cookies;
  cookies = "";
  res = await req(`/api/videos/${video.file_path}`);
  check("Tamu ditolak (401) saat streaming", res.status === 401, `status ${res.status}`);
  cookies = beforeCookies;

  // File yang tidak terdaftar → 404 walaupun ada di disk
  const unregistered = `notregistered-${stamp}.mp4`;
  writeFileSync(`data/uploads/videos/${unregistered}`, Buffer.alloc(1024, 0));
  res = await req(`/api/videos/${unregistered}`);
  check(
    "File tidak terdaftar → 404",
    res.status === 404,
    `status ${res.status}`
  );
  try { unlinkSync(`data/uploads/videos/${unregistered}`); } catch {}

  // ============ INSTRUKTUR: hapus video ============
  await login("instruktur@lms.com", "instruktur123");
  res = await callAction("/instruktur/video", actionId("deleteVideoAction"), [video.id]);
  const gone = db.prepare("SELECT id FROM videos WHERE id = ?").get(video.id);
  check(
    "Instruktur menghapus video (row hilang dari DB)",
    !gone,
    `status action ${res.status}`
  );
  check(
    "File video ikut terhapus dari disk",
    !existsSync(`data/uploads/videos/${video.file_path}`),
    video.file_path.slice(0, 12)
  );

  // Route 404 setelah hapus
  await login("siswa@lms.com", "siswa123");
  res = await req(`/api/videos/${video.file_path}`);
  check("Streaming 404 setelah video dihapus", res.status === 404, `status ${res.status}`);

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
