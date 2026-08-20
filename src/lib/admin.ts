import "server-only";
import { db, ensureSchema } from "./db";
import { getCurrentYear } from "./settings";
import type { House } from "./houses";

export type TeacherStat = {
  id: number;
  name: string;
  active: boolean;
  submissions: number;
  awardsGiven: number;
  points: number;
  lastAward: string | null;
};

/**
 * Per-teacher logging, kept out of the assembly display on purpose — it is a
 * management view, not a scoreboard for staff.
 */
export async function getTeacherStats(): Promise<TeacherStat[]> {
  const year = await getCurrentYear();
  const res = await db().execute({
    sql: `SELECT t.id                                    AS id,
                 t.name                                  AS name,
                 t.active                                AS active,
                 COUNT(DISTINCT a.batch_id)              AS submissions,
                 COUNT(a.id)                             AS awards_given,
                 COALESCE(SUM(a.points), 0)              AS points,
                 MAX(a.created_at)                       AS last_award
          FROM teachers t
          LEFT JOIN awards a
            ON a.teacher_id = t.id AND a.year_id = ? AND a.voided_at IS NULL
          GROUP BY t.id
          ORDER BY points DESC, t.name COLLATE NOCASE`,
    args: [year.id],
  });
  return res.rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    active: Number(r.active) === 1,
    submissions: Number(r.submissions),
    awardsGiven: Number(r.awards_given),
    points: Number(r.points),
    lastAward: r.last_award === null ? null : String(r.last_award),
  }));
}

export type AdminStudent = {
  id: number;
  name: string;
  classCode: string;
  house: House;
  points: number;
  active: boolean;
};

export async function searchStudents(
  query: string,
  limit = 100,
): Promise<AdminStudent[]> {
  const year = await getCurrentYear();
  const like = `%${query.trim()}%`;
  const res = await db().execute({
    sql: `SELECT s.id                       AS id,
                 s.name                     AS name,
                 s.class_code               AS class_code,
                 s.house                    AS house,
                 s.active                   AS active,
                 COALESCE(SUM(CASE WHEN a.voided_at IS NULL THEN a.points END), 0) AS points
          FROM students s
          LEFT JOIN awards a ON a.student_id = s.id
          WHERE s.year_id = ?
            AND (? = '' OR s.name LIKE ? COLLATE NOCASE OR s.class_code LIKE ? COLLATE NOCASE)
          GROUP BY s.id
          ORDER BY s.class_code COLLATE NOCASE, s.name COLLATE NOCASE
          LIMIT ?`,
    args: [year.id, query.trim(), like, like, limit],
  });
  return res.rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    classCode: String(r.class_code),
    house: String(r.house) as House,
    points: Number(r.points),
    active: Number(r.active) === 1,
  }));
}

export type LogEntry = {
  batchId: string;
  kind: "student" | "house";
  teacherName: string;
  house: string;
  classCode: string | null;
  count: number;
  total: number;
  createdAt: string;
  voided: boolean;
};

/** The full ledger, newest first, grouped into the batches teachers submitted. */
export async function getAwardLog(limit = 100, offset = 0): Promise<LogEntry[]> {
  const year = await getCurrentYear();
  const res = await db().execute({
    sql: `SELECT a.batch_id                   AS batch_id,
                 MIN(a.kind)                  AS kind,
                 t.name                       AS teacher_name,
                 MIN(a.house)                 AS house,
                 MIN(a.class_code)            AS class_code,
                 COUNT(*)                     AS count,
                 SUM(a.points)                AS total,
                 MIN(a.created_at)            AS created_at,
                 MAX(a.voided_at IS NOT NULL) AS voided
          FROM awards a
          JOIN teachers t ON t.id = a.teacher_id
          WHERE a.year_id = ?
          GROUP BY a.batch_id
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?`,
    args: [year.id, limit, offset],
  });
  return res.rows.map((r) => ({
    batchId: String(r.batch_id),
    kind: String(r.kind) as "student" | "house",
    teacherName: String(r.teacher_name),
    house: String(r.house),
    classCode: r.class_code === null ? null : String(r.class_code),
    count: Number(r.count),
    total: Number(r.total),
    createdAt: String(r.created_at),
    voided: Number(r.voided) === 1,
  }));
}

export type AdminOverview = {
  yearName: string;
  students: number;
  teachers: number;
  classes: number;
  awards: number;
  points: number;
};

export async function getOverview(): Promise<AdminOverview> {
  await ensureSchema();
  const year = await getCurrentYear();
  const c = db();
  const [students, teachers, awards] = await Promise.all([
    c.execute({
      sql: `SELECT COUNT(*) AS n, COUNT(DISTINCT class_code) AS c
            FROM students WHERE year_id = ? AND active = 1`,
      args: [year.id],
    }),
    c.execute("SELECT COUNT(*) AS n FROM teachers WHERE active = 1"),
    c.execute({
      sql: `SELECT COUNT(*) AS n, COALESCE(SUM(points), 0) AS p
            FROM awards WHERE year_id = ? AND voided_at IS NULL`,
      args: [year.id],
    }),
  ]);
  return {
    yearName: year.name,
    students: Number(students.rows[0].n),
    classes: Number(students.rows[0].c),
    teachers: Number(teachers.rows[0].n),
    awards: Number(awards.rows[0].n),
    points: Number(awards.rows[0].p),
  };
}

/** Full ledger export for the SharePoint snapshot and for record-keeping. */
export async function exportAwardsCsv(): Promise<string> {
  const year = await getCurrentYear();
  const res = await db().execute({
    sql: `SELECT a.created_at, t.name AS teacher, a.kind, s.name AS student,
                 a.class_code, a.house, a.points, a.voided_at
          FROM awards a
          JOIN teachers t ON t.id = a.teacher_id
          LEFT JOIN students s ON s.id = a.student_id
          WHERE a.year_id = ?
          ORDER BY a.created_at`,
    args: [year.id],
  });
  const header = "timestamp,teacher,type,student,class,house,points,voided";
  const lines = res.rows.map((r) =>
    [
      r.created_at,
      r.teacher,
      r.kind,
      r.student ?? "",
      r.class_code ?? "",
      r.house,
      r.points,
      r.voided_at ? "yes" : "no",
    ]
      .map(csvCell)
      .join(","),
  );
  return [header, ...lines].join("\n");
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
