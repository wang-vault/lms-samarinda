// Test tambahan Tahap 3: materi PDF approved bisa diunduh siswa & ditolak untuk tamu.
const BASE = "http://localhost:3000";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
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
  for (const c of res.headers.getSetCookie?.() || []) {
    const pair = c.split(";")[0];
    const name = pair.split("=")[0];
    cookies = cookies.split("; ").filter((p) => !p.startsWith(name + "=")).join("; ");
    if (!/expires=Thu, 01 Jan 1970/i.test(c)) cookies = cookies ? cookies + "; " + pair : pair;
  }
  return res;
}
async function login(email, password) {
  const { csrfToken } = await (await req("/api/auth/csrf")).json();
  await req("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email, password, csrfToken }).toString(),
  });
}
function actionId(name) {
  const m = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8"));
  for (const [id, e] of Object.entries(m.node || {})) if (e && e.exportedName === name) return id;
  throw new Error("tidak ketemu: " + name);
}
async function callAction(page, id, args) {
  return req(page, { method: "POST", headers: { "next-action": id, Origin: BASE }, body: await encodeReply(args) });
}

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
}

const stamp = Date.now().toString(36);
await login("instruktur@lms.com", "instruktur123");
const course = db.prepare("SELECT id FROM courses ORDER BY created_at DESC LIMIT 1").get();

const pdfBytes = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]>>endobj\n" +
    "xref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n0\n%%EOF\n"
);
const form = new FormData();
form.append("courseId", course.id);
form.append("title", `PDF Approve Test ${stamp}`);
form.append("type", "pdf");
form.append("content", "PDF untuk uji approve.");
form.append("file", new File([pdfBytes], `uji-approve-${stamp}.pdf`, { type: "application/pdf" }));
let res = await callAction("/instruktur/materi", actionId("createMaterialAction"), [null, form]);
check("POST createMaterialAction (pdf)", res.status === 200, `status ${res.status}`);

const mat = db.prepare("SELECT id, file_path FROM materials WHERE title = ?").get(`PDF Approve Test ${stamp}`);
if (!mat) { console.log("materi PDF tidak tersimpan"); process.exit(1); }
console.log("  file_path:", mat.file_path);

// Tamu tidak boleh mengakses file materi (wajib login + approved)
const url = `/api/materials/pdf/${mat.file_path}`;
const guest = await fetch(BASE + url, { redirect: "manual" });
check("GET /api/materials/pdf/... oleh tamu ditolak", guest.status === 401, `status ${guest.status}`);

// Admin approve
await login("admin@lms.com", "admin123");
res = await callAction("/admin/materi", actionId("approveMaterialAction"), [mat.id]);
check("POST approveMaterialAction (pdf)", res.status === 200, `status ${res.status}`);

// Siswa mengunduh
await login("siswa@lms.com", "siswa123");
const dl = await req(url);
const ct = dl.headers.get("content-type") || "";
check("GET /api/materials/pdf/... oleh siswa", dl.status === 200 && ct.includes("pdf"), `status ${dl.status} ${ct}`);
if (dl.status === 200) {
  const buf = Buffer.from(await dl.arrayBuffer());
  check("Isi response = PDF yang diupload", buf.slice(0, 8).toString().startsWith("%PDF-"), buf.slice(0, 8).toString());
}

const html = await (await req("/siswa/materi")).text();
check("PDF approved muncul di daftar siswa", html.includes(`PDF Approve Test ${stamp}`));

console.log("\nTotal:", results.length, "Gagal:", results.filter((x) => !x.ok).length);
if (results.some((x) => !x.ok)) process.exitCode = 1;
