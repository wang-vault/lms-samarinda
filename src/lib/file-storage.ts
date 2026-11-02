// Helper penyimpanan file lokal (PDF materi & video) di folder data/uploads
// File disajikan melalui route handler dengan pengecekan auth — tidak publik.

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const MATERIALS_DIR = path.join(process.cwd(), "data", "uploads", "materials");
const VIDEOS_DIR = path.join(process.cwd(), "data", "uploads", "videos");

const ALLOWED_MATERIAL_EXTENSIONS = [".pdf"];
const MAX_MATERIAL_BYTES = 20 * 1024 * 1024; // 20 MB

const ALLOWED_VIDEO_EXTENSIONS = [".mp4", ".webm"];
const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB

/** Simpan file upload, kembalikan nama file acak yang aman. */
export async function saveMaterialFile(file: File): Promise<string> {
  await fs.mkdir(MATERIALS_DIR, { recursive: true });

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_MATERIAL_EXTENSIONS.includes(ext)) {
    throw new Error("Hanya file PDF yang diperbolehkan.");
  }
  if (file.size > MAX_MATERIAL_BYTES) {
    throw new Error("Ukuran file maksimal 20 MB.");
  }

  const filename = `${crypto.randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(MATERIALS_DIR, filename), buffer);
  return filename;
}

/** Baca file materi dari disk. */
export async function readMaterialFile(filename: string): Promise<Buffer> {
  const safe = path.basename(filename);
  return fs.readFile(path.join(MATERIALS_DIR, safe));
}

/** Hapus file materi dari disk (ignore error jika tidak ada). */
export async function deleteMaterialFile(filename: string): Promise<void> {
  try {
    const safe = path.basename(filename);
    await fs.unlink(path.join(MATERIALS_DIR, safe));
  } catch {
    // File sudah tidak ada — biarkan
  }
}

// ============================================
// VIDEO
// ============================================

/**
 * Simpan file video upload ke data/uploads/videos.
 * Kembalikan nama file acak (UUID) dengan ekstensi aslinya.
 */
export async function saveVideoFile(file: File): Promise<string> {
  await fs.mkdir(VIDEOS_DIR, { recursive: true });

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_VIDEO_EXTENSIONS.includes(ext)) {
    throw new Error("Hanya file MP4 atau WebM yang diperbolehkan.");
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error("Ukuran file video maksimal 500 MB.");
  }

  const filename = `${crypto.randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(VIDEOS_DIR, filename), buffer);
  return filename;
}

/** Baca file video dari disk (ukuran + path aman dari traversal). */
export async function readVideoFile(filename: string): Promise<{ buffer: Buffer; size: number }> {
  const safe = path.basename(filename);
  const filePath = path.join(VIDEOS_DIR, safe);
  const stat = await fs.stat(filePath);
  return { buffer: await fs.readFile(filePath), size: stat.size };
}

/** Baca sebagian file video untuk streaming HTTP Range. */
export async function readVideoRange(
  filename: string,
  start: number,
  end: number
): Promise<{ chunk: Buffer; total: number }> {
  const safe = path.basename(filename);
  const filePath = path.join(VIDEOS_DIR, safe);
  const stat = await fs.stat(filePath);
  const fileHandle = await fs.open(filePath, "r");
  try {
    const length = end - start + 1;
    const chunk = Buffer.alloc(length);
    await fileHandle.read(chunk, 0, length, start);
    return { chunk, total: stat.size };
  } finally {
    await fileHandle.close();
  }
}

/** Ukuran total file video (0 jika file tidak ada). */
export async function videoFileSize(filename: string): Promise<number> {
  try {
    const safe = path.basename(filename);
    const stat = await fs.stat(path.join(VIDEOS_DIR, safe));
    return stat.size;
  } catch {
    return 0;
  }
}

/** Hapus file video dari disk (ignore error jika tidak ada). */
export async function deleteVideoFile(filename: string): Promise<void> {
  try {
    const safe = path.basename(filename);
    await fs.unlink(path.join(VIDEOS_DIR, safe));
  } catch {
    // File sudah tidak ada — biarkan
  }
}

/**
 * Baca metadata durasi video MP4 dari box 'moov/mvhd'.
 * Kembalikan detik; 0 jika tidak bisa dibaca (mis. format WebM tanpa moov).
 *
 * Catatan: box 'moov' biasanya berada di awal file (faststart) atau di akhir.
 * Agar tidak memuat file ratusan MB seluruhnya ke memori, hanya region awal
 * dan akhir file yang dipindai.
 */
export async function readMp4DurationSeconds(filename: string): Promise<number> {
  try {
    const safe = path.basename(filename);
    const filePath = path.join(VIDEOS_DIR, safe);
    const stat = await fs.stat(filePath);
    if (stat.size === 0) return 0;

    const REGION = Math.min(stat.size, 16 * 1024 * 1024);

    // Pindai awal file
    let buffer = await readVideoRegion(filePath, 0, REGION);
    let duration = parseMvhdDuration(buffer);
    if (duration > 0) return duration;

    // Jika tidak ketemu, pindai akhir file
    if (stat.size > REGION) {
      buffer = await readVideoRegion(filePath, stat.size - REGION, REGION);
      duration = parseMvhdDuration(buffer);
    }
    return duration;
  } catch {
    return 0;
  }
}

/** Baca sebagian file video dari byte `start` sepanjang `length`. */
async function readVideoRegion(
  filePath: string,
  start: number,
  length: number
): Promise<Buffer> {
  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, start);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/**
 * Cari box 'moov' lalu box 'mvhd' di dalamnya, dan ambil durasinya.
 * Box MP4: 4 byte ukuran + 4 byte type, lalu isi.
 */
function parseMvhdDuration(buffer: Buffer): number {
  // Pindai box tingkat atas mencari box 'moov'.
  // Catatan: tidak memakai buffer.indexOf("moov") karena "moov" adalah
  // substring dari header box itu sendiri — pencarian harus per-box.
  let offset = 0;
  while (offset + 8 <= buffer.length) {
    const size = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (size < 8 || offset + size > buffer.length) {
      offset += 8; // box terpotong region — lanjutkan konservatif
      continue;
    }
    if (type === "moov") {
      const dur = scanMvhd(buffer, offset + 8, offset + size);
      if (dur > 0) return dur;
    }
    offset += size;
  }
  return 0;
}

/** Pindai isi box 'moov' mencari box 'mvhd'; kembalikan durasi dalam detik. */
function scanMvhd(buffer: Buffer, start: number, end: number): number {
  let inner = start;
  while (inner + 8 <= end) {
    const innerSize = buffer.readUInt32BE(inner);
    const innerType = buffer.toString("ascii", inner + 4, inner + 8);
    if (innerSize < 8 || inner + innerSize > end) break;
    if (innerType === "mvhd") {
      const version = buffer.readUInt8(inner + 8);
      let timescale: number;
      let duration: number;
      // Setelah 8 byte header box, field mvhd dimulai:
      //  v1: version+flags(4) creation(8) modification(8) timescale(4) duration(8)
      //  v0: version+flags(4) creation(4) modification(4) timescale(4) duration(4)
      if (version === 1) {
        timescale = buffer.readUInt32BE(inner + 8 + 4 + 8 + 8);
        // Duration 64 bit — ambil 32 bit bawah (cukup untuk durasi realistis)
        duration = buffer.readUInt32BE(inner + 8 + 4 + 8 + 8 + 4 + 4);
      } else {
        timescale = buffer.readUInt32BE(inner + 8 + 4 + 4);
        duration = buffer.readUInt32BE(inner + 8 + 4 + 4 + 4);
      }
      if (timescale > 0) return duration / timescale;
      return 0;
    }
    inner += innerSize;
  }
  return 0;
}

/** Format detik menjadi "HH:MM:SS" atau "MM:SS". */
export function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds < 0) return "0:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}
