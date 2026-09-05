import "server-only";
import { db, ensureSchema } from "./db";
import { getCurrentYear, defaultYearName } from "./settings";
import type { House } from "./houses";
import { parseRosterCsv, type ParsedStudent } from "./roster-csv";

export { parseRosterCsv };
export type { ParsedStudent, ParseResult } from "./roster-csv";

/**
 * Closes the current year and opens a fresh one with this roster. Points start
 * at zero because every total is scoped to the year; last year's ledger stays
 * intact and exportable rather than being deleted.
 */
export async function startNewYear(
  students: ParsedStudent[],
  yearName?: string,
): Promise<{ yearId: number; name: string; students: number }> {
  await ensureSchema();
  const c = db();
  const name = (yearName ?? "").trim() || defaultYearName();

  await c.execute("UPDATE school_years SET is_current = 0, ended_at = datetime('now') WHERE is_current = 1");
  const created = await c.execute({
    sql: "INSERT INTO school_years (name, is_current) VALUES (?, 1) RETURNING id",
    args: [name],
  });
  const yearId = Number(created.rows[0].id);
  const count = await insertStudents(yearId, students);
  return { yearId, name, students: count };
}

async function insertStudents(yearId: number, students: ParsedStudent[]): Promise<number> {
  if (students.length === 0) return 0;
  const c = db();
  // Chunked so a 600+ row import stays well inside statement limits.
  const CHUNK = 100;
  for (let i = 0; i < students.length; i += CHUNK) {
    const slice = students.slice(i, i + CHUNK);
    await c.batch(
      slice.map((s) => ({
        sql: `INSERT INTO students (year_id, name, class_code, house, external_id)
              VALUES (?, ?, ?, ?, ?)`,
        args: [yearId, s.name, s.classCode, s.house, s.externalId ?? null],
      })),
      "write",
    );
  }
  return students.length;
}

/* ---------------- admin edits ---------------- */

/**
 * Adds a single student mid-year — a new arrival, or a transfer from another
 * campus. They start on zero, which is correct: their points begin when they do.
 *
 * Returns null when an active student of the same name is already in that
 * class, so the caller can say so rather than quietly creating a duplicate.
 */
export async function addStudent(student: {
  name: string;
  classCode: string;
  house: House;
  externalId?: string;
}): Promise<number | null> {
  const year = await getCurrentYear();
  const c = db();

  const existing = await c.execute({
    sql: `SELECT id FROM students
          WHERE year_id = ? AND active = 1
            AND name = ? COLLATE NOCASE AND class_code = ? COLLATE NOCASE
          LIMIT 1`,
    args: [year.id, student.name.trim(), student.classCode.trim()],
  });
  if (existing.rows.length > 0) return null;

  const created = await c.execute({
    sql: `INSERT INTO students (year_id, name, class_code, house, external_id)
          VALUES (?, ?, ?, ?, ?) RETURNING id`,
    args: [
      year.id,
      student.name.trim(),
      student.classCode.trim(),
      student.house,
      student.externalId?.trim() || null,
    ],
  });
  return Number(created.rows[0].id);
}

export async function moveStudent(
  studentId: number,
  changes: { classCode?: string; house?: House; name?: string },
): Promise<void> {
  await ensureSchema();
  const sets: string[] = [];
  const args: (string | number)[] = [];
  if (changes.name) {
    sets.push("name = ?");
    args.push(changes.name.trim());
  }
  if (changes.classCode) {
    sets.push("class_code = ?");
    args.push(changes.classCode.trim());
  }
  if (changes.house) {
    sets.push("house = ?");
    args.push(changes.house);
  }
  if (sets.length === 0) return;
  args.push(studentId);
  await db().execute({
    sql: `UPDATE students SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });
}

export async function setStudentActive(studentId: number, active: boolean): Promise<void> {
  await ensureSchema();
  await db().execute({
    sql: "UPDATE students SET active = ? WHERE id = ?",
    args: [active ? 1 : 0, studentId],
  });
}

export async function addTeacher(name: string): Promise<void> {
  await ensureSchema();
  const trimmed = name.trim();
  if (!trimmed) return;
  const existing = await db().execute({
    sql: "SELECT id FROM teachers WHERE name = ? COLLATE NOCASE LIMIT 1",
    args: [trimmed],
  });
  if (existing.rows.length) {
    await db().execute({
      sql: "UPDATE teachers SET active = 1 WHERE id = ?",
      args: [Number(existing.rows[0].id)],
    });
    return;
  }
  await db().execute({
    sql: "INSERT INTO teachers (name) VALUES (?)",
    args: [trimmed],
  });
}

/**
 * Teachers are deactivated, never deleted — their past awards must keep a name
 * attached for the admin log to make sense.
 */
export async function setTeacherActive(teacherId: number, active: boolean): Promise<void> {
  await ensureSchema();
  await db().execute({
    sql: "UPDATE teachers SET active = ? WHERE id = ?",
    args: [active ? 1 : 0, teacherId],
  });
}
