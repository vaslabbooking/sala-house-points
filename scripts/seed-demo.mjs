/**
 * Loads last year's roster and point totals into a database, for demonstrating
 * the app with names and figures people recognise.
 *
 * Point totals are reproduced exactly: each student's real total is split into
 * plausible awards, grouped into per-class batches by a teacher, so the award
 * log, teacher activity and house standings all look like a term of genuine
 * use rather than random noise.
 *
 * Local:
 *   node scripts/seed-demo.mjs
 * Against Turso:
 *   TURSO_DATABASE_URL=libsql://… TURSO_AUTH_TOKEN=… node scripts/seed-demo.mjs
 *
 * Everything it writes belongs to one school year, so "Start New Year" in
 * Admin clears it when you are ready for the real roster.
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { parse } from "csv-parse/sync";
import { createClient } from "@libsql/client";

const YEAR_NAME = process.env.DEMO_YEAR ?? "2025-26 (demo)";
const WEEKS_OF_HISTORY = 8;
const MAX_PER_AWARD = 10; // matches the school's per-lesson guideline
const CLASS_BATCH = 12;

const url = process.env.TURSO_DATABASE_URL ?? "file:data/housepoints.db";
const client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const rows = (path) =>
  parse(readFileSync(path, "utf8"), { skip_empty_lines: true, bom: true, trim: true }).slice(1);

const students = rows("demo-data/students.csv").map(([name, classCode, house, points]) => ({
  name,
  classCode,
  house,
  points: Number(points) || 0,
}));
const teachers = rows("demo-data/teachers.csv").map(([name, points]) => ({
  name,
  weight: Number(points) || 0,
}));

if (students.length === 0) {
  console.error("No demo data found. Run: python3 scripts/export-legacy-data.py");
  process.exit(1);
}

console.log(`Seeding ${url.startsWith("file:") ? "local database" : "Turso"} …`);

/* ---------- schema (matches src/lib/db.ts) ---------- */
for (const statement of [
  `CREATE TABLE IF NOT EXISTS school_years (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, is_current INTEGER NOT NULL DEFAULT 0, started_at TEXT NOT NULL DEFAULT (datetime('now')), ended_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS students (id INTEGER PRIMARY KEY AUTOINCREMENT, year_id INTEGER NOT NULL REFERENCES school_years(id), name TEXT NOT NULL, class_code TEXT NOT NULL, house TEXT NOT NULL, external_id TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS teachers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS awards (id INTEGER PRIMARY KEY AUTOINCREMENT, year_id INTEGER NOT NULL REFERENCES school_years(id), batch_id TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('student','house')), teacher_id INTEGER NOT NULL REFERENCES teachers(id), student_id INTEGER REFERENCES students(id), house TEXT NOT NULL, class_code TEXT, points INTEGER NOT NULL, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), voided_at TEXT, voided_by TEXT, CHECK ((kind='house' AND student_id IS NULL) OR (kind='student' AND student_id IS NOT NULL)))`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
]) {
  await client.execute(statement);
}

/* ---------- a fresh year, leaving any existing one closed but intact ---------- */
await client.execute(
  "UPDATE school_years SET is_current = 0, ended_at = datetime('now') WHERE is_current = 1",
);
const created = await client.execute({
  sql: "INSERT INTO school_years (name, is_current) VALUES (?, 1) RETURNING id",
  args: [YEAR_NAME],
});
const yearId = Number(created.rows[0].id);

const run = async (statements, label) => {
  const CHUNK = 250;
  for (let i = 0; i < statements.length; i += CHUNK) {
    await client.batch(statements.slice(i, i + CHUNK), "write");
    process.stdout.write(`\r  ${label}: ${Math.min(i + CHUNK, statements.length)}/${statements.length}`);
  }
  process.stdout.write("\n");
};

await run(
  students.map((s) => ({
    sql: "INSERT INTO students (year_id, name, class_code, house) VALUES (?, ?, ?, ?)",
    args: [yearId, s.name, s.classCode, s.house],
  })),
  "students",
);
// Teachers are not scoped to a year, so only add names that are not already
// there — otherwise re-running the seed duplicates every teacher, splitting
// their totals and doubling up the entry screen's name picker.
const existingTeachers = new Set(
  (await client.execute("SELECT name FROM teachers")).rows.map((r) =>
    String(r.name).trim().toLowerCase(),
  ),
);
const newTeachers = teachers.filter(
  (t) => !existingTeachers.has(t.name.trim().toLowerCase()),
);
if (newTeachers.length > 0) {
  await run(
    newTeachers.map((t) => ({ sql: "INSERT INTO teachers (name) VALUES (?)", args: [t.name] })),
    "teachers",
  );
} else {
  console.log("  teachers: already present, none added");
}

const studentRows = (
  await client.execute({
    sql: "SELECT id, name, class_code, house FROM students WHERE year_id = ?",
    args: [yearId],
  })
).rows;
const teacherRows = (await client.execute("SELECT id, name FROM teachers")).rows;

/* ---------- turn totals into believable batches ---------- */
const byId = new Map(studentRows.map((r) => [`${r.name}|${r.class_code}`, r]));
const owing = [];
for (const s of students) {
  const row = byId.get(`${s.name}|${s.classCode}`);
  if (row && s.points > 0) {
    owing.push({
      id: Number(row.id),
      classCode: String(row.class_code),
      house: String(row.house),
      left: s.points,
    });
  }
}

const byClass = new Map();
for (const entry of owing) {
  if (!byClass.has(entry.classCode)) byClass.set(entry.classCode, []);
  byClass.get(entry.classCode).push(entry);
}

// Teachers are picked in proportion to how much they actually awarded, so the
// admin activity table shows the same lopsided distribution as last year.
const weighted = teacherRows
  .map((r) => ({
    id: Number(r.id),
    weight: teachers.find((t) => t.name === String(r.name))?.weight ?? 0,
  }))
  .filter((t) => t.weight > 0);
const totalWeight = weighted.reduce((sum, t) => sum + t.weight, 0);
const pickTeacher = () => {
  let n = Math.random() * totalWeight;
  for (const t of weighted) {
    n -= t.weight;
    if (n <= 0) return t.id;
  }
  return weighted[weighted.length - 1].id;
};

const NOW = Date.now();
const stamp = () => {
  const at = new Date(NOW - Math.random() * WEEKS_OF_HISTORY * 7 * 24 * 3600 * 1000);
  return at.toISOString().slice(0, 19).replace("T", " ");
};

const awards = [];
for (const [classCode, pupils] of byClass) {
  let remaining = pupils.filter((p) => p.left > 0);
  while (remaining.length > 0) {
    const teacherId = pickTeacher();
    const batchId = randomUUID();
    const createdAt = stamp();
    for (const pupil of remaining.slice(0, CLASS_BATCH)) {
      const amount = Math.min(pupil.left, 1 + Math.floor(Math.random() * MAX_PER_AWARD));
      pupil.left -= amount;
      awards.push({
        sql: `INSERT INTO awards (year_id, batch_id, kind, teacher_id, student_id, house, class_code, points, created_at)
              VALUES (?, ?, 'student', ?, ?, ?, ?, ?, ?)`,
        args: [yearId, batchId, teacherId, pupil.id, pupil.house, classCode, amount, createdAt],
      });
    }
    remaining = remaining.filter((p) => p.left > 0);
  }
}

// A handful of whole-house awards, as the new system allows.
for (const house of ["Bears", "Eagles", "Sharks", "Tigers"]) {
  for (let i = 0; i < 3; i++) {
    awards.push({
      sql: `INSERT INTO awards (year_id, batch_id, kind, teacher_id, student_id, house, class_code, points, created_at)
            VALUES (?, ?, 'house', ?, NULL, ?, NULL, ?, ?)`,
      args: [yearId, randomUUID(), pickTeacher(), house, 25 + Math.floor(Math.random() * 75), stamp()],
    });
  }
}

await run(awards, "awards");

const check = await client.execute({
  sql: `SELECT house, SUM(points) AS points FROM awards
        WHERE year_id = ? AND voided_at IS NULL AND kind = 'student'
        GROUP BY house ORDER BY points DESC`,
  args: [yearId],
});
console.log(`\nSeeded "${YEAR_NAME}" — house totals from student awards:`);
for (const row of check.rows) {
  console.log(`  ${String(row.house).padEnd(8)} ${Number(row.points).toLocaleString()}`);
}
console.log(`  ${awards.length.toLocaleString()} award rows across ${students.length} students`);
