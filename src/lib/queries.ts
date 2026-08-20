import "server-only";
import { randomUUID } from "node:crypto";
import { db, ensureSchema } from "./db";
import { getCurrentYear } from "./settings";
import { HOUSES, type House } from "./houses";

export type Teacher = { id: number; name: string };
export type Student = {
  id: number;
  name: string;
  classCode: string;
  house: House;
};
export type HouseTotal = { house: House; points: number };
export type StudentTotal = Student & { points: number };
export type ClassTotal = { classCode: string; points: number };

export async function getTeachers(): Promise<Teacher[]> {
  await ensureSchema();
  const res = await db().execute(
    "SELECT id, name FROM teachers WHERE active = 1 ORDER BY name COLLATE NOCASE",
  );
  return res.rows.map((r) => ({ id: Number(r.id), name: String(r.name) }));
}

export async function getClassCodes(): Promise<string[]> {
  const year = await getCurrentYear();
  const res = await db().execute({
    sql: `SELECT DISTINCT class_code FROM students
          WHERE year_id = ? AND active = 1
          ORDER BY class_code COLLATE NOCASE`,
    args: [year.id],
  });
  return res.rows.map((r) => String(r.class_code));
}

export async function getClassRoster(classCode: string): Promise<Student[]> {
  const year = await getCurrentYear();
  const res = await db().execute({
    sql: `SELECT id, name, class_code, house FROM students
          WHERE year_id = ? AND active = 1 AND class_code = ?
          ORDER BY name COLLATE NOCASE`,
    args: [year.id, classCode],
  });
  return res.rows.map(toStudent);
}

function toStudent(r: Record<string, unknown>): Student {
  return {
    id: Number(r.id),
    name: String(r.name),
    classCode: String(r.class_code),
    house: String(r.house) as House,
  };
}

/* ---------------- leaderboards ---------------- */

/**
 * House totals come from the snapshot on each award row, not from the
 * student's current house — points stay with the house they were earned for.
 * Whole-house awards (student_id IS NULL) are included here and nowhere else.
 */
export async function getHouseTotals(): Promise<HouseTotal[]> {
  const year = await getCurrentYear();
  const res = await db().execute({
    sql: `SELECT house, COALESCE(SUM(points), 0) AS points
          FROM awards
          WHERE year_id = ? AND voided_at IS NULL
          GROUP BY house`,
    args: [year.id],
  });
  const totals = new Map(res.rows.map((r) => [String(r.house), Number(r.points)]));
  return HOUSES.map((house) => ({ house, points: totals.get(house) ?? 0 })).sort(
    (a, b) => b.points - a.points || a.house.localeCompare(b.house),
  );
}

/**
 * Top individual contributors to each house. Grouped by the house the points
 * were awarded for, so a student who changed house still counts towards the
 * house they earned for. Whole-house awards are excluded — they belong to
 * everyone, so crediting them to individuals would be misleading.
 */
export async function getTopStudentsByHouse(
  limit = 5,
): Promise<Record<House, StudentTotal[]>> {
  const year = await getCurrentYear();
  const res = await db().execute({
    sql: `SELECT a.house          AS house,
                 s.id             AS id,
                 s.name           AS name,
                 s.class_code     AS class_code,
                 SUM(a.points)    AS points
          FROM awards a
          JOIN students s ON s.id = a.student_id
          WHERE a.year_id = ? AND a.voided_at IS NULL AND a.kind = 'student'
          GROUP BY a.house, s.id
          HAVING SUM(a.points) > 0
          ORDER BY a.house, points DESC, s.name COLLATE NOCASE`,
    args: [year.id],
  });

  const byHouse = emptyHouseMap<StudentTotal>();
  for (const r of res.rows) {
    const house = String(r.house) as House;
    if (!byHouse[house] || byHouse[house].length >= limit) continue;
    byHouse[house].push({
      id: Number(r.id),
      name: String(r.name),
      classCode: String(r.class_code),
      house,
      points: Number(r.points),
    });
  }
  return byHouse;
}

/**
 * Top contributing classes within each house — i.e. for Tigers, which classes'
 * Tigers earned the most. A class appears in several houses' lists, which is
 * expected: every class has students spread across all four.
 *
 * Attribution follows the student's *current* class, so a student moving class
 * mid-year takes their points with them.
 */
export async function getTopClassesByHouse(
  limit = 3,
): Promise<Record<House, ClassTotal[]>> {
  const year = await getCurrentYear();
  const res = await db().execute({
    sql: `SELECT a.house       AS house,
                 s.class_code  AS class_code,
                 SUM(a.points) AS points
          FROM awards a
          JOIN students s ON s.id = a.student_id
          WHERE a.year_id = ? AND a.voided_at IS NULL AND a.kind = 'student'
          GROUP BY a.house, s.class_code
          HAVING SUM(a.points) > 0
          ORDER BY a.house, points DESC, s.class_code COLLATE NOCASE`,
    args: [year.id],
  });

  const byHouse = emptyHouseMap<ClassTotal>();
  for (const r of res.rows) {
    const house = String(r.house) as House;
    if (!byHouse[house] || byHouse[house].length >= limit) continue;
    byHouse[house].push({
      classCode: String(r.class_code),
      points: Number(r.points),
    });
  }
  return byHouse;
}

function emptyHouseMap<T>(): Record<House, T[]> {
  return Object.fromEntries(HOUSES.map((h) => [h, [] as T[]])) as Record<House, T[]>;
}

/* ---------------- submitting ---------------- */

export type StudentAward = { studentId: number; points: number };

/**
 * Writes one batch of awards atomically. Because every award is its own row,
 * two teachers submitting at the same moment simply insert alongside each
 * other — there is no shared total to race over.
 *
 * Returns the batch id so the teacher can undo what they just sent.
 */
export async function submitStudentAwards(
  teacherId: number,
  awards: StudentAward[],
  note?: string,
): Promise<{ batchId: string; count: number; total: number }> {
  const year = await getCurrentYear();
  const c = db();

  const meaningful = awards.filter((a) => Number.isFinite(a.points) && a.points !== 0);
  if (meaningful.length === 0) return { batchId: "", count: 0, total: 0 };

  // Resolve each student's house and class at this moment; these are frozen
  // onto the award rows so later moves cannot rewrite history.
  const ids = meaningful.map((a) => a.studentId);
  const placeholders = ids.map(() => "?").join(",");
  const roster = await c.execute({
    sql: `SELECT id, house, class_code FROM students
          WHERE year_id = ? AND active = 1 AND id IN (${placeholders})`,
    args: [year.id, ...ids],
  });
  const lookup = new Map(
    roster.rows.map((r) => [
      Number(r.id),
      { house: String(r.house), classCode: String(r.class_code) },
    ]),
  );

  const batchId = randomUUID();
  const statements = [];
  let total = 0;
  for (const award of meaningful) {
    const student = lookup.get(award.studentId);
    if (!student) continue; // removed from the roster mid-entry
    total += award.points;
    statements.push({
      sql: `INSERT INTO awards
              (year_id, batch_id, kind, teacher_id, student_id, house, class_code, points, note)
            VALUES (?, ?, 'student', ?, ?, ?, ?, ?, ?)`,
      args: [
        year.id,
        batchId,
        teacherId,
        award.studentId,
        student.house,
        student.classCode,
        Math.round(award.points),
        note ?? null,
      ],
    });
  }

  if (statements.length === 0) return { batchId: "", count: 0, total: 0 };
  await c.batch(statements, "write");
  return { batchId, count: statements.length, total };
}

/** A whole-house award: one ledger row, credited to the house alone. */
export async function submitHouseAward(
  teacherId: number,
  house: House,
  points: number,
  note?: string,
): Promise<{ batchId: string }> {
  const year = await getCurrentYear();
  const batchId = randomUUID();
  await db().execute({
    sql: `INSERT INTO awards
            (year_id, batch_id, kind, teacher_id, student_id, house, class_code, points, note)
          VALUES (?, ?, 'house', ?, NULL, ?, NULL, ?, ?)`,
    args: [year.id, batchId, teacherId, house, Math.round(points), note ?? null],
  });
  return { batchId };
}

export type BatchSummary = {
  batchId: string;
  kind: "student" | "house";
  teacherName: string;
  house: string | null;
  classCode: string | null;
  count: number;
  total: number;
  createdAt: string;
  voided: boolean;
};

/** Recent submissions by one teacher, for the undo list on the entry screen. */
export async function getRecentBatches(
  teacherId: number,
  limit = 5,
): Promise<BatchSummary[]> {
  const year = await getCurrentYear();
  const res = await db().execute({
    sql: `SELECT a.batch_id                    AS batch_id,
                 MIN(a.kind)                   AS kind,
                 t.name                        AS teacher_name,
                 MIN(a.house)                  AS house,
                 MIN(a.class_code)             AS class_code,
                 COUNT(*)                      AS count,
                 SUM(a.points)                 AS total,
                 MIN(a.created_at)             AS created_at,
                 MAX(a.voided_at IS NOT NULL)  AS voided
          FROM awards a
          JOIN teachers t ON t.id = a.teacher_id
          WHERE a.year_id = ? AND a.teacher_id = ?
          GROUP BY a.batch_id
          ORDER BY created_at DESC
          LIMIT ?`,
    args: [year.id, teacherId, limit],
  });
  return res.rows.map((r) => ({
    batchId: String(r.batch_id),
    kind: String(r.kind) as "student" | "house",
    teacherName: String(r.teacher_name),
    house: r.house === null ? null : String(r.house),
    classCode: r.class_code === null ? null : String(r.class_code),
    count: Number(r.count),
    total: Number(r.total),
    createdAt: String(r.created_at),
    voided: Number(r.voided) === 1,
  }));
}

/**
 * Voiding leaves the rows in place and excludes them from every total, so the
 * ledger stays a complete record of what happened — including the mistakes.
 */
export async function voidBatch(batchId: string, voidedBy: string): Promise<number> {
  await ensureSchema();
  const res = await db().execute({
    sql: `UPDATE awards SET voided_at = datetime('now'), voided_by = ?
          WHERE batch_id = ? AND voided_at IS NULL`,
    args: [voidedBy, batchId],
  });
  return res.rowsAffected;
}
