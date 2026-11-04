// Layanan Chatbot AI "Bizzy" untuk LMS Mulai Usaha dari Nol di Samarinda
// Menggunakan @anthropic-ai/sdk dengan fallback cerdas berbasis pengetahuan lokal

import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { courses, materials } from "@/db/schema";
import { eq } from "drizzle-orm";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id?: string;
  role: ChatRole;
  content: string;
  createdAt?: string | Date;
};

/**
 * Bersihkan output AI dari karakter non-Latin/non-Indonesia yang tidak diinginkan.
 * Model lokal/proxy kadang menghasilkan karakter Cina, Jepang, Thailand, Arab, dll.
 * Fungsi ini mempertahankan: huruf Latin (termasuk aksara Indonesia), angka, tanda baca umum,
 * emoji, spasi, baris baru, dan karakter markdown.
 */
export function sanitizeAIOutput(text: string): string {
  // Deteksi apakah teks mengandung blok karakter non-Latin (CJK, Thai, Arab, dll.)
  // yang bukan bagian dari bahasa Indonesia normal.
  // Regex: karakter CJK Unified, Hiragana, Katakana, Thai, Arabic, Devanagari, dll.
  const nonLatinBlockRegex = /[\u{2E80}-\u{9FFF}\u{AC00}-\u{D7AF}\u{0E00}-\u{0E7F}\u{0600}-\u{06FF}\u{0900}-\u{097F}\u{3040}-\u{30FF}\u{31F0}-\u{31FF}\u{F900}-\u{FAFF}]+/gu;

  let cleaned = text.replace(nonLatinBlockRegex, "");

  // Bersihkan sisa artefak: spasi ganda, baris kosong berlebihan
  cleaned = cleaned.replace(/  +/g, " ");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  // Bersihkan spasi di awal/akhir setiap baris
  cleaned = cleaned
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();

  return cleaned;
}

/** Ambil ringkasan kursus & materi LMS dari database sebagai konteks AI */
export async function getLmsKnowledgeSummary(): Promise<string> {
  try {
    const courseList = await db
      .select({
        id: courses.id,
        title: courses.title,
        description: courses.description,
      })
      .from(courses);

    if (courseList.length === 0) {
      return "Belum ada kursus aktif tambahan di katalog LMS saat ini.";
    }

    const matList = await db
      .select({
        title: materials.title,
        courseId: materials.courseId,
        type: materials.type,
      })
      .from(materials)
      .where(eq(materials.status, "approved"));

    const lines = courseList.map((c) => {
      const mats = matList
        .filter((m) => m.courseId === c.id)
        .map((m) => `${m.title} (${m.type})`)
        .join(", ");
      return `- Kursus "${c.title}": ${c.description || "Tidak ada deskripsi"}. Materi terbit: ${
        mats || "belum ada materi terbit"
      }`;
    });

    return lines.join("\n");
  } catch {
    // ponytail: fallback string jika DB gagal diakses, cegah kegagalan chat
    return "Katalog LMS Mulai Usaha dari Nol di Samarinda.";
  }
}

/** Bangun system prompt untuk Bizzy */
export function buildSystemPrompt(
  lmsContext: string,
  userName?: string
): string {
  const greeting = userName ? `Siswa yang sedang Anda ajak bicara bernama "${userName}".` : "";

  return `Anda adalah "Bizzy", asisten AI konsultan wirausaha ramah, sabar, dan penuh semangat untuk platform pembelajaran online "Mulai Usaha dari Nol di Samarinda".
${greeting}

Misi utama Anda:
Membantu calon wirausahawan pemula, UMKM, dan siswa LMS di Kota Samarinda (Kalimantan Timur) merintis, mengelola, dan mengembangkan usaha mereka dari nol sampai berhasil.

Pedoman respons:
1. BAHASA: WAJIB gunakan bahasa Indonesia saja. Dilarang keras menggunakan bahasa lain (Inggris, Mandarin, Jepang, Thailand, Arab, dll.) dalam respons. Semua kalimat, istilah, dan penjelasan harus dalam bahasa Indonesia yang santun, hangat, profesional, mudah dipahami, dan menyemangati. Jika ada istilah teknis asing, berikan terjemahan/penjelasan bahasa Indonesia di sampingnya.
2. LOKALITAS SAMARINDA: Berikan saran yang relevan dengan kondisi riil Kota Samarinda dan sekitarnya (seperti kawasan ramai Tepian Mahakam, Citra Niaga, Jl. Lambung Mangkurat, Samarinda Seberang, Sungai Kunjang; tren kuliner amplang, pempek, kopi lokal, oleh-oleh Kaltim; potensi IKN Nusantara terdekat). Pastikan semua nama tempat, institusi, dan program yang disebut benar-benar ada dan akurat. Jangan mengarang nama tempat atau lembaga fiktif.
3. PRAKTIS & BERTINDAK: Jangan hanya berteori. Berikan langkah konkrit 1-2-3 yang bisa dieksekusi hari ini dengan modal minim (sistem Pre-Order, konsinyasi warung, pemasaran WhatsApp & Instagram/TikTok).
4. LEGALITAS UMKM: Arahkan pembuatan legalitas usaha secara benar dan gratis melalui OSS (oss.go.id) untuk NIB, izin P-IRT di Dinas Kesehatan Kota Samarinda, dan sertifikasi Halal gratis (SEHATI).
5. KONTEKS MATERI LMS: Gunakan konteks kursus berikut jika siswa bertanya tentang pelajaran di LMS:
---
${lmsContext}
---
6. FORMAT: Gunakan formatting markdown yang rapi (bullet points, bold untuk penekanan penting, langkah berurutan) agar mudah dibaca di ponsel.
7. KEBIJAKAN: Jangan menjanjikan keuntungan pasti. Ingatkan pentingnya riset pasar dan pencatatan arus kas secara disiplin.
8. KUALITAS OUTPUT: Pastikan setiap kalimat lengkap dan masuk akal. Jangan menghasilkan teks yang terpotong, campur-aduk bahasa, atau mengandung karakter aneh. Jika tidak yakin dengan suatu informasi, katakan "saya kurang yakin" daripada mengarang.`;
}

/** Sanitasi pesan agar sesuai dengan spesifikasi Anthropic Messages API */
export function sanitizeMessages(
  rawMessages: ChatMessage[]
): Array<{ role: "user" | "assistant"; content: string }> {
  // Hanya ambil pesan yang memiliki konten teks
  const valid = rawMessages
    .filter((m) => typeof m.content === "string" && m.content.trim().length > 0)
    .map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content.trim(),
    }));

  if (valid.length === 0) return [];

  // Messages API mensyaratkan pesan pertama harus dari "user"
  const firstUserIdx = valid.findIndex((m) => m.role === "user");
  if (firstUserIdx === -1) return [];

  const trimmed = valid.slice(firstUserIdx);

  // Gabungkan pesan berurutan yang memiliki role yang sama
  const merged: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const msg of trimmed) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === msg.role) {
      prev.content += "\n\n" + msg.content;
    } else {
      merged.push({ role: msg.role, content: msg.content });
    }
  }

  // Batasi riwayat ke 20 percakapan terakhir agar efisien
  return merged.slice(-20);
}

/** Generator jawaban lokal berkualitas tinggi ketika ANTHROPIC_API_KEY belum disetel */
export function generateLocalFallbackAnswer(
  userQuery: string,
  lmsContext: string,
  userName?: string
): string {
  const q = userQuery.toLowerCase();
  const nameGreeting = userName ? `Halo kak **${userName}**! ` : "Halo! ";

  // 1. Pertanyaan seputar kuliner & makanan
  if (
    q.includes("kuliner") ||
    q.includes("makanan") ||
    q.includes("minuman") ||
    q.includes("kopi") ||
    q.includes("amplang") ||
    q.includes("snack")
  ) {
    return `${nameGreeting}Senang sekali membahas ide usaha kuliner di Samarinda! Kuliner adalah salah satu sektor paling hidup di kota ini.

Berikut panduan langkah praktis memulai usaha kuliner dari nol:

### 1. Ide Produk Potensial di Samarinda
- **Inovasi Oleh-Oleh Lokal:** Olahan amplang aneka rasa (rumput laut, pedas daun jeruk), atau keripik pisang khas Kutai.
- **Minuman & Kopi Kekinian Terjangkau:** Kopi susu gula aren atau teh buah dengan harga mahasiswa/pelajar (Rp 8.000 - Rp 15.000).
- **Makanan Siap Saji Pre-Order (PO):** Rice bowl lauk lokal, nasi kuning Samarinda porsi sarapan kantor/kampus.

### 2. Strategi Modal Minim (< Rp 1 Juta)
- **Gunakan Dapur Rumah:** Jangan sewa tempat dulu. Manfaatkan peralatan memasak yang sudah ada di rumah.
- **Sistem Pre-Order (PO):** Buka pesanan H-1 lewat WhatsApp & Instagram Stories. Beli bahan baku HANYA setelah uang masuk atau pemesan terkonfirmasi.
- **Konsinyasi (Titip Jual):** Titipkan produk yang sudah dipack rapi ke warung kopi, kantin kampus (Unmul/Polnes), atau toko oleh-oleh sekitar Samarinda.

### 3. Titik Ramai & Target Pasar di Samarinda
- Area **Tepian Mahakam & Citra Niaga** (pusat nongkrong anak muda sore-malam).
- Sekitar **Jl. Pramuka & Jl. Perjuangan** (pasar mahasiswa kampus Unmul).
- Kawasan perumahan padat di **Samarinda Seberang & Sungai Kunjang**.

Langkah pertama hari ini: buat 5 porsi sampel produkmu, bagikan ke teman terdekat di Samarinda, dan minta kritik jujur tentang rasa serta kemasannya!`;
  }

  // 2. Pertanyaan seputar perizinan, legalitas, NIB, PIRT, halal
  if (
    q.includes("izin") ||
    q.includes("legalitas") ||
    q.includes("nib") ||
    q.includes("pirt") ||
    q.includes("p-irt") ||
    q.includes("halal") ||
    q.includes("oss")
  ) {
    return `${nameGreeting}Legalitas usaha adalah fondasi penting agar bisnis UMKM kita di Samarinda bisa naik kelas dan dipercaya konsumen.

Kabar baiknya: Sekarang mengurus izin usaha mikro **100% GRATIS dan ONLINE**!

### 1. Nomor Induk Berusaha (NIB)
- **Website resmi:** [oss.go.id](https://oss.go.id)
- **Persyaratan:** KTP, NPWP pribadi (jika ada), nomor WhatsApp aktif, dan alamat usaha di Samarinda.
- **Waktu:** Kurang dari 30 menit langsung terbit secara digital.
- **Manfaat:** NIB berfungsi sekaligus sebagai SIUP, TDP, dan identitas resmi usahamu untuk mengajukan KUR perbankan.

### 2. Sertifikasi P-IRT (Pangan Industri Rumah Tangga)
- Diperlukan untuk produk pangan olahan kering (keripik, kue kering, abon, sambal botol).
- Didaftarkan melalui portal **SPP-IRT** yang terintegrasi dengan OSS.
- Pelatihan penyuluhan keamanan pangan (PKP) diadakan secara berkala oleh **Dinas Kesehatan Kota Samarinda**.

### 3. Sertifikasi Halal Gratis (Program SEHATI)
- Untuk pelaku usaha mikro dengan proses produk halal sederhana (self-declare).
- Daftarkan melalui portal **ptsp.halal.go.id** (BPJPH).

*Tips Bizzy:* Jangan menunggu izin lengkap baru mulai jualan. Urus NIB sekarang sambil mulai tes pasar produkmu secara kecil-kecilan!`;
  }

  // 3. Pertanyaan seputar modal, dana, atau keuangan
  if (
    q.includes("modal") ||
    q.includes("uang") ||
    q.includes("dana") ||
    q.includes("keuangan") ||
    q.includes("biaya") ||
    q.includes("kas")
  ) {
    return `${nameGreeting}Banyak orang mengira memulai usaha harus punya modal puluhan juta rupiah. Padahal, memulai dari **Nol** artinya mengoptimalkan apa yang ada di tangan kita saat ini!

Berikut formula mengelola modal awal di Samarinda:

### 1. Mulai dengan Modal di Bawah Rp 500 Ribu
- **Model Bisnis Reseller / Dropshipper Lokal:** Jualkan produk UMKM Samarinda yang sudah ada (misal kain tenun Samarinda, amplang, atau frozen food) dengan mengambil margin keuntungan per item.
- **Jasa Berbasis Keahlian:** Desain grafis untuk UMKM Samarinda, foto produk makanan lewat HP, jasa admin medsos, atau les privat. Modal utamanya hanya kuota internet dan keahlianmu.

### 2. Aturan Emas Arus Kas Pemula
- **Pisahkan Rekening Pribadi & Usaha:** Buat 1 rekening bank khusus (atau e-wallet bisnis) agar uang usaha tidak terpakai untuk belanja harian.
- **Catat Setiap Rupiah:** Buat buku kas sederhana (Pemasukan, Pengeluaran, Saldo). Anda bisa pakai buku tulis atau aplikasi gratis seperti BukuKas.
- **Putar Keuntungan (Reinvest):** Jangan ambil laba untuk konsumsi pribadi di 3 bulan pertama. Gulung kembali ke modal bahan baku agar stok makin bertambah.

Ingat, modal terbesar wirausahawan adalah **kepercayaan dan konsistensi**, bukan sekadar uang di rekening!`;
  }

  // 4. Pertanyaan seputar materi LMS atau kursus
  if (
    q.includes("kursus") ||
    q.includes("materi") ||
    q.includes("lms") ||
    q.includes("modul") ||
    q.includes("ujian") ||
    q.includes("pelajaran")
  ) {
    return `${nameGreeting}Di platform **LMS Mulai Usaha dari Nol di Samarinda**, materi dirancang secara bertahap agar mudah dipelajari siapa saja:

### Kurikulum Pembelajaran:
1. **Modul 1: Menemukan & Memvalidasi Ide Bisnis**
   - Menggali kebutuhan masyarakat Samarinda dan riset kompetitor lokal.
2. **Modul 2: Perencanaan Operasional & Keuangan Awal**
   - Menghitung HPP (Harga Pokok Penjualan) dan menentukan harga jual yang pas.
3. **Modul 3: Pemasaran Digital & Branding Lokal**
   - Memaksimalkan media sosial tanpa iklan berbayar (organik marketing).
4. **Modul 4: Legalitas Usaha & Evaluasi Bisnis**
   - Mengurus NIB dan persiapan ujian sertifikasi kelulusan.

${lmsContext ? `\n**Status Kursus di Sistem Saat Ini:**\n${lmsContext}\n` : ""}

Silakan buka tab **Materi** atau **Video** di menu sebelah kiri untuk mulai belajar materi terbit, dan ikuti **Ujian** untuk mendapatkan sertifikat resmi!`;
  }

  // 5. Pertanyaan seputar promosi, marketing, dan penjualan
  if (
    q.includes("promosi") ||
    q.includes("marketing") ||
    q.includes("jual") ||
    q.includes("iklan") ||
    q.includes("tiktok") ||
    q.includes("instagram") ||
    q.includes("pelanggan")
  ) {
    return `${nameGreeting}Mendapatkan 10 pelanggan pertama di Samarinda adalah tonggak paling membanggakan!

Berikut strategi pemasaran lokal yang terbukti efektif dan gratis:

### 1. Pemasaran Media Sosial Kontekstual Samarinda
- **Konten Cerita (Storytelling):** Jangan hanya posting foto produk. Ceritakan proses di balik layar (behind the scene), misalnya belanja bahan baku di Pasar Segiri atau proses packing pesanan.
- **Gunakan Tagar & Lokasi Samarinda:** Cantumkan lokasi *Samarinda, Kalimantan Timur*, serta tagar lokal (#KulinerSamarinda, #SamarindaHits, #UMKMSamarinda).
- **Kolaborasi Mikro-Influencer Lokal:** Kirimkan tester gratis ke teman atau konten kreator lokal Samarinda yang punya followers aktif di lingkungan sekitar.

### 2. Manfaatkan Lingkaran Terdekat (Circle 1)
- Hubungi 20 kontak terdekat di WhatsApp. Ceritakan dengan antusias bahwa Anda baru membuka usaha dan minta masukan mereka.
- Buat penawaran khusus pembukaan: "Beli 1 Dapat 1 untuk 10 pemesan pertama di Samarinda".

### 3. Google Bisnisku (Google Maps)
- Daftarkan titik usahamu di Google Maps secara gratis. Orang di Samarinda sering mencari "makanan terdekat" atau "toko terdekat" lewat Maps.

Konsistensi memposting setiap hari jam 11.00 siang (sebelum makan siang) dan jam 17.00 sore (pulang kerja) sangat membantu menarik perhatian warga Samarinda!`;
  }

  // 6. Respon umum ramah dan memotivasi
  return `${nameGreeting}Saya Bizzy, asisten konsultan wirausahamu di Samarinda!

Pertanyaan yang bagus sekali. Dalam merintis usaha dari nol di Samarinda, ada tiga pilar utama yang perlu kita pegang:
1. **Validasi Masalah & Kebutuhan:** Pastikan produk/jasa yang kita tawarkan benar-benar memecahkan masalah atau disukai oleh masyarakat Samarinda.
2. **Mulai dari Skala Kecil:** Jangan terburu-buru menyewa ruko atau membeli alat mahal. Uji respons pasar dulu dengan modal seminimal mungkin.
3. **Disiplin Eksekusi:** Catat transaksi, jaga kualitas rasa/pelayanan, dan terus dengarkan masukan pelanggan.

Kira-kira produk atau ide usaha apa yang sedang ingin kamu kembangkan saat ini? Ceritakan ke Bizzy, yuk kita susun strategi konkritnya bersama!`;
}

/**
 * Panggil Anthropic Messages API jika ANTHROPIC_API_KEY tersedia,
 * atau gunakan fallback lokal yang kaya jika belum diatur.
 */
export async function getChatCompletion({
  messages,
  userName,
}: {
  messages: ChatMessage[];
  userName?: string;
}): Promise<string> {
  const sanitized = sanitizeMessages(messages);
  if (sanitized.length === 0) {
    throw new Error("Daftar pesan tidak boleh kosong");
  }

  const lmsContext = await getLmsKnowledgeSummary();
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

  // Jika API key belum diisi, gunakan generator jawaban lokal yang cerdas
  if (!apiKey) {
    const lastUserMessage =
      [...sanitized].reverse().find((m) => m.role === "user")?.content || "";
    const base = generateLocalFallbackAnswer(lastUserMessage, lmsContext, userName);
    return `${base}\n\n---\n*Catatan: Menjawab via basis pengetahuan lokal Bizzy (Mode Standar).*`;
  }

  // Panggil Anthropic API
  const client = new Anthropic({
    apiKey,
    baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
    timeout: 5000,
    maxRetries: 1,
  });

  const model = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
  const systemPrompt = buildSystemPrompt(lmsContext, userName);

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: sanitized,
    });

    let fullText = "";
    for (const block of response.content) {
      if (block.type === "text") {
        fullText += block.text;
      }
    }
    const cleaned = sanitizeAIOutput(fullText);
    if (!cleaned || cleaned.trim().length === 0) {
      throw new Error("Respons teks kosong dari model upstream.");
    }
    return cleaned;
  } catch {
    // Tangani error API (misal kuota habis, timeout, proxy down, atau respons kosong) dengan fallback aman
    const lastUserMessage =
      [...sanitized].reverse().find((m) => m.role === "user")?.content || "";
    const base = generateLocalFallbackAnswer(lastUserMessage, lmsContext, userName);
    return `${base}\n\n---\n*Pemberitahuan: Layanan Claude API sementara tidak dapat dihubungi. Menjawab via basis pengetahuan lokal.*`;
  }
}
