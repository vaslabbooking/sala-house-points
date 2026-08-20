/**
 * Development seeding only — fills a local database with a realistic roster and
 * a spread of awards so the screens can be checked with something like real
 * data. Never point this at production.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { parse } from "csv-parse/sync";
import { randomUUID } from "node:crypto";

const [, , rosterPath, teachersPath] = process.argv;
if (!rosterPath || !teachersPath) {
  console.error("usage: node scripts/seed-dev.mjs <roster.csv> <teachers.csv>");
  process.exit(1);
}

const c = createClient({ url: process.env.TURSO_DATABASE_URL ?? "file:data/housepoints.db" });

function rows(path) {
  // Real CSV parsing matters here: several staff names contain commas.
  return parse(readFileSync(path, "utf8"), {
    skip_empty_lines: true,
    bom: true,
    trim: true,
  }).slice(1);
}

await c.execute("DELETE FROM awards");
await c.execute("DELETE FROM students");
await c.execute("DELETE FROM teachers");
await c.execute("DELETE FROM school_years");

const year = await c.execute({
  sql: "INSERT INTO school_years (name, is_current) VALUES (?, 1) RETURNING id",
  args: ["2026-27"],
});
const yearId = Number(year.rows[0].id);

const students = rows(rosterPath);
for (let i = 0; i < students.length; i += 100) {
  await c.batch(
    students.slice(i, i + 100).map(([name, classCode, house]) => ({
      sql: "INSERT INTO students (year_id, name, class_code, house) VALUES (?, ?, ?, ?)",
      args: [yearId, name, classCode, house],
    })),
    "write",
  );
}

const teachers = rows(teachersPath);
await c.batch(
  teachers.map(([name]) => ({
    sql: "INSERT INTO teachers (name) VALUES (?)",
    args: [name],
  })),
  "write",
);

const studentRows = (
  await c.execute({
    sql: "SELECT id, house, class_code FROM students WHERE year_id = ?",
    args: [yearId],
  })
).rows;
const teacherRows = (await c.execute("SELECT id FROM teachers")).rows;

// A few hundred plausible batches so leaderboards have shape to them.
const awards = [];
for (let b = 0; b < 300; b++) {
  const teacherId = Number(teacherRows[Math.floor(Math.random() * teacherRows.length)].id);
  const batchId = randomUUID();
  const size = 3 + Math.floor(Math.random() * 12);
  for (let i = 0; i < size; i++) {
    const s = studentRows[Math.floor(Math.random() * studentRows.length)];
    awards.push({
      sql: `INSERT INTO awards (year_id, batch_id, kind, teacher_id, student_id, house, class_code, points)
            VALUES (?, ?, 'student', ?, ?, ?, ?, ?)`,
      args: [yearId, batchId, teacherId, Number(s.id), String(s.house), String(s.class_code), 1 + Math.floor(Math.random() * 5)],
    });
  }
}
for (const house of ["Bears", "Eagles", "Sharks", "Tigers"]) {
  for (let i = 0; i < 3; i++) {
    const teacherId = Number(teacherRows[Math.floor(Math.random() * teacherRows.length)].id);
    awards.push({
      sql: `INSERT INTO awards (year_id, batch_id, kind, teacher_id, student_id, house, class_code, points)
            VALUES (?, ?, 'house', ?, NULL, ?, NULL, ?)`,
      args: [yearId, randomUUID(), teacherId, house, 10 + Math.floor(Math.random() * 40)],
    });
  }
}
for (let i = 0; i < awards.length; i += 100) {
  await c.batch(awards.slice(i, i + 100), "write");
}

console.log(`seeded ${students.length} students, ${teachers.length} teachers, ${awards.length} awards`);
