// Script verifikasi cepat isi database
const D = require("better-sqlite3");
const d = new D("./data/lms.db");
const tables = d
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_drizzle%'"
  )
  .all();
console.log("Tabel:", tables.map((x) => x.name).join(", "));
const users = d.prepare("SELECT email, role FROM users").all();
console.log("Users:", JSON.stringify(users, null, 2));
const courses = d.prepare("SELECT id, title FROM courses ORDER BY created_at DESC").all();
console.log("Courses:", JSON.stringify(courses, null, 2));
const mats = d
  .prepare(
    "SELECT m.title, m.type, m.status, c.title AS course FROM materials m LEFT JOIN courses c ON m.course_id = c.id ORDER BY m.created_at DESC"
  )
  .all();
console.log("Materials:", JSON.stringify(mats, null, 2));

