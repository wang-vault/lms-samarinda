// Script uji alur autentikasi end-to-end
// Jalankan: node scripts/test-auth.mjs

const BASE = "http://localhost:3000";

// Cookie jar sederhana
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

async function login(jar, email, password) {
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

async function get(jar, path) {
  return fetch(`${BASE}${path}`, {
    headers: { cookie: jar.header() },
    redirect: "manual",
  });
}

let pass = 0;
let fail = 0;
function check(name, ok, extra = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}${extra ? " — " + extra : ""}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${extra ? " — " + extra : ""}`);
  }
}

const cases = [
  { email: "admin@lms.com", password: "admin123", role: "admin", home: "/admin" },
  {
    email: "instruktur@lms.com",
    password: "instruktur123",
    role: "instruktur",
    home: "/instruktur",
  },
  { email: "siswa@lms.com", password: "siswa123", role: "siswa", home: "/siswa" },
];

for (const c of cases) {
  console.log(`\n== Login ${c.role} ==`);
  const jar = makeJar();
  await login(jar, c.email, c.password);

  const sessionRes = await get(jar, "/api/auth/session");
  const session = await sessionRes.json();
  check("sesi terbentuk", session?.user?.email === c.email, session?.user?.email);
  check("role di sesi benar", session?.user?.role === c.role, session?.user?.role);

  const homeRes = await get(jar, c.home);
  check(`akses ${c.home}`, homeRes.status === 200, `status ${homeRes.status}`);

  // Login page harus redirect ke dashboard bila sudah login
  const loginPage = await get(jar, "/login");
  const loc = loginPage.headers.get("location");
  check(
    "/login redirect ke dashboard",
    loginPage.status === 307 && loc === c.home,
    `status ${loginPage.status} loc ${loc}`
  );
}

// Cek isolasi antar role
console.log("\n== Isolasi antar role ==");
const siswaJar = makeJar();
await login(siswaJar, "siswa@lms.com", "siswa123");
for (const p of ["/admin", "/instruktur"]) {
  const r = await get(siswaJar, p);
  const loc = r.headers.get("location");
  check(
    `siswa tidak bisa akses ${p}`,
    r.status === 307 && loc === "/siswa",
    `status ${r.status} loc ${loc}`
  );
}

const adminJar = makeJar();
await login(adminJar, "admin@lms.com", "admin123");
for (const p of ["/siswa", "/instruktur"]) {
  const r = await get(adminJar, p);
  const loc = r.headers.get("location");
  check(
    `admin tidak bisa akses ${p}`,
    r.status === 307 && loc === "/admin",
    `status ${r.status} loc ${loc}`
  );
}

// Password salah harus ditolak
console.log("\n== Password salah ==");
const badJar = makeJar();
await login(badJar, "siswa@lms.com", "salah-password");
const badSession = await (await get(badJar, "/api/auth/session")).json();
check("login password salah ditolak", !badSession?.user, JSON.stringify(badSession));

console.log(`\nHasil: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
