// Script verifikasi render dan struktur layout setiap halaman
const BASE = "http://localhost:3000";

function makeJar() {
  const jar = new Map();
  return {
    header() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    setFrom(res) {
      const raw = res.headers.getSetCookie?.() ?? [];
      for (const c of raw) {
        const [pair] = c.split(";");
        const idx = pair.indexOf("=");
        const name = pair.slice(0, idx).trim();
        const value = pair.slice(idx + 1).trim();
        if (value === "" || /expires=Thu, 01 Jan 1970/i.test(c)) jar.delete(name);
        else jar.set(name, value);
      }
    },
  };
}

let jar = makeJar();

async function req(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: jar.header() },
    redirect: "manual",
  });
  jar.setFrom(res);
  return res;
}

async function login(email, password) {
  jar = makeJar();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, {
    headers: { cookie: jar.header() },
    redirect: "manual",
  });
  jar.setFrom(csrfRes);
  const { csrfToken } = await csrfRes.json();

  const body = new URLSearchParams({
    email,
    password,
    csrfToken,
    callbackUrl: BASE,
  });

  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: jar.header(),
    },
    body,
    redirect: "manual",
  });
  jar.setFrom(res);
  return res;
}

function verifyHtmlStructure(pagePath, html, isDashboard = true) {
  // 1. Cek header
  const headerCount = (html.match(/<header\b/gi) || []).length;
  // 2. Cek aside (desktop sidebar + mobile drawer ada 2 aside di dashboard-shell)
  const asideCount = (html.match(/<aside\b/gi) || []).length;
  // 3. Cek main
  const mainCount = (html.match(/<main\b/gi) || []).length;

  if (isDashboard) {
    if (headerCount !== 1) {
      throw new Error(`Halaman ${pagePath} memiliki ${headerCount} <header> (harus tepat 1)`);
    }
    if (mainCount !== 1) {
      throw new Error(`Halaman ${pagePath} memiliki ${mainCount} <main> (harus tepat 1)`);
    }
    if (asideCount < 1 || asideCount > 2) {
      throw new Error(`Halaman ${pagePath} memiliki ${asideCount} <aside> (abnormal)`);
    }
  } else {
    // AuthShell & Landing
    if (headerCount !== 1) {
      throw new Error(`Halaman publik ${pagePath} memiliki ${headerCount} <header> (harus tepat 1)`);
    }
    if (mainCount !== 1) {
      throw new Error(`Halaman publik ${pagePath} memiliki ${mainCount} <main> (harus tepat 1)`);
    }
  }
}

async function testPage(path, isDashboard = true) {
  const res = await req(path);
  if (res.status !== 200) {
    throw new Error(`GET ${path} gagal: HTTP ${res.status}`);
  }
  const html = await res.text();
  verifyHtmlStructure(path, html, isDashboard);
  console.log(`  ✓ ${path} (HTTP 200, layout valid)`);
}

async function main() {
  console.log("=== VERIFIKASI SEMUA HALAMAN & STRUKTUR LAYOUT ===\n");

  // 1. Publik / Auth
  console.log("1. Halaman Publik & Auth:");
  jar = makeJar();
  await testPage("/", false);
  await testPage("/login", false);
  await testPage("/register", false);

  // 2. Siswa Pages
  console.log("\n2. Halaman Siswa (Role: Siswa):");
  await login("siswa@lms.com", "siswa123");
  const siswaPages = [
    "/siswa",
    "/siswa/materi",
    "/siswa/video",
    "/siswa/ujian",
    "/siswa/sertifikat",
    "/siswa/chat",
    "/siswa/forum",
    "/siswa/jadwal",
    "/siswa/leaderboard",
    "/siswa/notifikasi",
    "/siswa/profil",
  ];
  for (const page of siswaPages) {
    await testPage(page, true);
  }

  // 3. Instruktur Pages
  console.log("\n3. Halaman Instruktur (Role: Instruktur):");
  await login("instruktur@lms.com", "instruktur123");
  const instrukturPages = [
    "/instruktur",
    "/instruktur/kursus",
    "/instruktur/materi",
    "/instruktur/video",
    "/instruktur/quiz",
    "/instruktur/sertifikat",
    "/instruktur/forum",
    "/instruktur/notifikasi",
    "/instruktur/profil",
  ];
  for (const page of instrukturPages) {
    await testPage(page, true);
  }

  // 4. Admin Pages
  console.log("\n4. Halaman Admin (Role: Admin):");
  await login("admin@lms.com", "admin123");
  const adminPages = [
    "/admin",
    "/admin/materi",
    "/admin/pengguna",
    "/admin/notifikasi",
    "/admin/profil",
  ];
  for (const page of adminPages) {
    await testPage(page, true);
  }

  console.log("\n=== SELURUH 28 HALAMAN BERHASIL DIVERIFIKASI TANPA ERROR ===");
}

main().catch((err) => {
  console.error("Gagal verifikasi halaman:", err);
  process.exit(1);
});
