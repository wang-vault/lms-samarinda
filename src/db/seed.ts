// Seed data awal: admin, instruktur, siswa demo
// Jalankan: npx tsx src/db/seed.ts

import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

const dbPath = path.join(
  process.cwd(),
  process.env.DATABASE_PATH ?? "./data/lms.db"
);
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// IIFE async agar bisa pakai await
async function main() {
  // Buat tabel jika belum ada (sinkron dengan schema.ts)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'siswa',
      avatar_url TEXT,
      bio TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  const count = sqlite
    .prepare("SELECT COUNT(*) as count FROM users")
    .get() as { count: number };
  if (count.count > 0) {
    console.log("Data sudah ada, seed dilewati.");
    return;
  }
  const users = [
    {
      name: "Administrator",
      email: "admin@lms.com",
      role: "admin",
      password: "admin123",
    },
    {
      name: "Budi Instruktur",
      email: "instruktur@lms.com",
      role: "instruktur",
      password: "instruktur123",
    },
    {
      name: "Sari Siswa",
      email: "siswa@lms.com",
      role: "siswa",
      password: "siswa123",
    },
  ];

  const insert = sqlite.prepare(
    "INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  );

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    insert.run(
      crypto.randomUUID(),
      u.name,
      u.email,
      hash,
      u.role,
      Math.floor(Date.now() / 1000)
    );
    console.log(`User dibuat: ${u.email} (${u.role})`);
  }

  console.log("Seed selesai.");
  console.log("Login: admin@lms.com / admin123");
  console.log("Login: instruktur@lms.com / instruktur123");
  console.log("Login: siswa@lms.com / siswa123");
}

main()
  .then(() => sqlite.close())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
