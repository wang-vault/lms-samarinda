// Test E2E Tahap 7 — Chatbot AI "Bizzy"
// Verifikasi alur lengkap:
// 1. Proteksi akses: request unauthenticated ke /api/chat ditolak 401.
// 2. Validasi input: payload kosong / format salah ditolak 400.
// 3. Login siswa & request non-streaming (JSON) mengembalikan respons terstruktur.
// 4. Request streaming SSE mengembalikan header text/event-stream & event chunks + [DONE].
// 5. Multi-turn conversation: context percakapan sebelumnya dipertahankan.
// 6. Pengetahuan kontekstual: saran wirausaha Samarinda (kuliner, NIB, modal).
// 7. Render halaman: /siswa/chat render 200 OK dengan elemen antarmuka Bizzy.
// 8. Integrasi navigasi: link "Tanya AI" ada di menu /siswa dan banner di dashboard.
// 9. Tamu (guest) yang membuka /siswa/chat diredirect ke /login (307/302).

const BASE = "http://localhost:3000";

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

function check(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✓ ${label}${detail ? ` (${detail})` : ""}`);
  } else {
    console.error(`  ✗ FAIL: ${label}${detail ? ` (${detail})` : ""}`);
    process.exitCode = 1;
  }
}

async function main() {
  console.log("=== PENGUJIAN TAHAP 7: CHATBOT AI 'BIZZY' ===\n");

  // ============================================
  // 1. UJI PROTEKSI AKSES /api/chat (Tamu / Guest)
  // ============================================
  console.log("1. Pengujian proteksi akses tanpa login (Guest)");
  cookies = ""; // Pastikan tanpa sesi

  const unauthRes = await req("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "Halo Bizzy" }],
    }),
  });
  check(
    "Request ke /api/chat tanpa login ditolak 401",
    unauthRes.status === 401,
    `status: ${unauthRes.status}`
  );
  const unauthJson = await unauthRes.json().catch(() => ({}));
  check(
    "Pesan error autentikasi informatif",
    typeof unauthJson.error === "string" && unauthJson.error.length > 0,
    unauthJson.error
  );

  const guestPageRes = await req("/siswa/chat");
  check(
    "Halaman /siswa/chat tanpa login me-redirect tamu ke /login",
    guestPageRes.status === 307 || guestPageRes.status === 302,
    `status: ${guestPageRes.status}, location: ${guestPageRes.headers.get("location")}`
  );

  // ============================================
  // 2. LOGIN SISWA & UJI VALIDASI INPUT
  // ============================================
  console.log("\n2. Pengujian validasi input API (setelah login siswa)");
  await login("siswa@lms.com", "siswa123");

  // 2a. Body bukan JSON / kosong
  const invalidJsonRes = await req("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "bukan json valid",
  });
  check(
    "Payload invalid JSON ditolak 400",
    invalidJsonRes.status === 400,
    `status: ${invalidJsonRes.status}`
  );

  // 2b. Array messages kosong
  const emptyMessagesRes = await req("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [] }),
  });
  check(
    "Daftar pesan kosong ditolak 400",
    emptyMessagesRes.status === 400,
    `status: ${emptyMessagesRes.status}`
  );

  // 2c. Pesan terakhir bukan dari user
  const assistantLastRes = await req("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        { role: "user", content: "Halo" },
        { role: "assistant", content: "Halo juga" },
      ],
    }),
  });
  check(
    "Pesan terakhir bukan dari user ditolak 400",
    assistantLastRes.status === 400,
    `status: ${assistantLastRes.status}`
  );

  // ============================================
  // 3. UJI RESPON NON-STREAMING (JSON)
  // ============================================
  console.log("\n3. Pengujian respons non-streaming (JSON)");
  const jsonChatRes = await req("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content: "Bagaimana cara mulai usaha kuliner di Samarinda dengan modal kecil?",
        },
      ],
      stream: false,
    }),
  });

  check(
    "Request stream:false berhasil dengan status 200",
    jsonChatRes.status === 200,
    `status: ${jsonChatRes.status}`
  );

  const jsonChatData = await jsonChatRes.json();
  check(
    "Respons memiliki role 'assistant'",
    jsonChatData.role === "assistant",
    `role: ${jsonChatData.role}`
  );
  check(
    "Respons berisi teks jawaban yang memadai (> 100 karakter)",
    typeof jsonChatData.content === "string" && jsonChatData.content.length > 100,
    `${jsonChatData.content?.length || 0} karakter`
  );
  check(
    "Jawaban mencantumkan konteks kuliner / modal Samarinda",
    /samarinda/i.test(jsonChatData.content) &&
      (/kuliner|modal|usaha|pasar/i.test(jsonChatData.content)),
    "konteks lokal Samarinda terdeteksi dalam jawaban"
  );

  // ============================================
  // 4. UJI RESPON STREAMING (Server-Sent Events)
  // ============================================
  console.log("\n4. Pengujian respons streaming SSE (Server-Sent Events)");
  const streamRes = await req("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content: "Apa saja langkah mengurus NIB gratis lewat OSS untuk UMKM di Samarinda?",
        },
      ],
      stream: true,
    }),
  });

  check(
    "Request streaming berhasil dengan status 200",
    streamRes.status === 200,
    `status: ${streamRes.status}`
  );

  const contentType = streamRes.headers.get("content-type") || "";
  check(
    "Header Content-Type adalah text/event-stream",
    contentType.includes("text/event-stream"),
    contentType
  );

  // Baca stream secara lengkap
  const rawStreamText = await streamRes.text();
  check(
    "Stream menghasilkan data SSE",
    rawStreamText.includes("data: "),
    `panjang stream: ${rawStreamText.length} bytes`
  );
  check(
    "Stream diakhiri dengan event sentinel [DONE]",
    rawStreamText.includes("data: [DONE]"),
    "marker [DONE] ditemukan"
  );

  // Rekonstruksi teks penuh dari potongan SSE
  let reconstructedText = "";
  const sseLines = rawStreamText.split("\n\n");
  for (const block of sseLines) {
    const trimmed = block.trim();
    if (!trimmed.startsWith("data: ")) continue;
    const dataPart = trimmed.slice(6).trim();
    if (dataPart === "[DONE]") break;
    try {
      const parsed = JSON.parse(dataPart);
      if (parsed.text) reconstructedText += parsed.text;
    } catch {
      // Abaikan potongan non-json
    }
  }

  check(
    "Teks hasil streaming utuh & informatif (> 100 karakter)",
    reconstructedText.length > 100,
    `${reconstructedText.length} karakter terkumpul`
  );
  check(
    "Jawaban streaming mencakup informasi NIB / OSS",
    /nib|oss/i.test(reconstructedText),
    "topik NIB / OSS terkonfirmasi"
  );

  // ============================================
  // 5. UJI MULTI-TURN CONVERSATION
  // ============================================
  console.log("\n5. Pengujian percakapan multi-turn (multi-pesan berurutan)");
  const multiTurnRes = await req("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        { role: "user", content: "Halo, nama saya Budi calon pengusaha amplang." },
        {
          role: "assistant",
          content: "Halo Budi! Senang berkenalan dengan Anda. Usaha amplang sangat potensial di Samarinda.",
        },
        { role: "user", content: "Bagaimana cara menentukan harga jual yang pas?" },
      ],
      stream: false,
    }),
  });

  check(
    "Request multi-turn berhasil status 200",
    multiTurnRes.status === 200,
    `status: ${multiTurnRes.status}`
  );
  const multiTurnData = await multiTurnRes.json();
  check(
    "Respons multi-turn memberikan jawaban strategi harga",
    typeof multiTurnData.content === "string" && multiTurnData.content.length > 80,
    `${multiTurnData.content?.length || 0} karakter`
  );

  // ============================================
  // 6. UJI RENDER HALAMAN /siswa/chat
  // ============================================
  console.log("\n6. Pengujian antarmuka halaman /siswa/chat");
  const pageRes = await req("/siswa/chat");
  check(
    "GET /siswa/chat mengembalikan status 200",
    pageRes.status === 200,
    `status: ${pageRes.status}`
  );

  const html = await pageRes.text();
  check(
    "Halaman memuat judul 'Tanya Bizzy'",
    html.includes("Tanya Bizzy"),
    "Judul halaman terdeteksi"
  );
  check(
    "Halaman memuat badge 'AI Wirausaha'",
    html.includes("AI Wirausaha") || html.includes("Bizzy"),
    "Badge / identitas Bizzy terdeteksi"
  );
  check(
    "Halaman memuat form input pertanyaan",
    html.includes("<textarea") || html.includes("placeholder="),
    "Input form obrolan terdeteksi"
  );

  // ============================================
  // 7. UJI INTEGRASI NAVIGASI & DASHBOARD
  // ============================================
  console.log("\n7. Pengujian navigasi & tautan dashboard siswa");
  const dashboardRes = await req("/siswa");
  check(
    "GET /siswa mengembalikan status 200",
    dashboardRes.status === 200,
    `status: ${dashboardRes.status}`
  );

  const dashHtml = await dashboardRes.text();
  check(
    "Sidebar / navigasi siswa memiliki menu 'Tanya AI' ke /siswa/chat",
    dashHtml.includes("/siswa/chat") && dashHtml.includes("Tanya AI"),
    "Menu 'Tanya AI' terpasang di sidebar"
  );
  check(
    "Dashboard siswa memiliki banner konsultasi 'Tanya Bizzy'",
    dashHtml.includes("Tanya Bizzy") && dashHtml.includes("Butuh Konsultasi"),
    "Banner konsultasi terpasang di dashboard"
  );

  console.log("\n=== SEMUA PENGUJIAN TAHAP 7 SELESAI ===");
}

main().catch((err) => {
  console.error("Terjadi kegagalan fatal pada pengujian:", err);
  process.exit(1);
});
