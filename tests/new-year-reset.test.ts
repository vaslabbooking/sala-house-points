import { beforeAll, afterAll, test, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "housepoints-newyear-"));
process.env.TURSO_DATABASE_URL = `file:${join(dir, "test.db")}`;

const { db, ensureSchema } = await import("@/lib/db");
const { submitStudentAwards, submitHouseAward, getHouseTotals, getTopStudentsByHouse } =
  await import("@/lib/queries");
const { startNewYear, deleteSchoolYear } = await import("@/lib/roster");
const {
  getOverview,
  getAwardLog,
  getTeacherStats,
  listSchoolYears,
  exportAwardsCsv,
  exportStudentTotalsCsv,
} = await import("@/lib/admin");

beforeAll(async () => {
  await ensureSchema();
  const c = db();
  await c.execute("INSERT INTO school_years (name, is_current) VALUES ('2025-26', 1)");
  await c.execute("INSERT INTO teachers (name) VALUES ('A Teacher')");
  await c.execute(
    "INSERT INTO students (year_id, name, class_code, house) VALUES (1,'OLD PUPIL','7.L.1E','Tigers')",
  );
  const id = Number((await c.execute("SELECT id FROM students")).rows[0].id);
  await submitStudentAwards(1, [{ studentId: id, points: 9 }]);
  await submitHouseAward(1, "Tigers", 50);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

test("everything carries the old year's data before the rollover", async () => {
  const overview = await getOverview();
  expect(overview.points).toBe(59);
  expect((await getAwardLog()).length).toBeGreaterThan(0);
  expect((await getTeacherStats())[0].points).toBe(59);
});

test("starting a new year resets every admin and display figure", async () => {
  await startNewYear([{ name: "NEW PUPIL", classCode: "7.L.1E", house: "Bears" }], "2026-27");

  const overview = await getOverview();
  expect(overview.yearName).toBe("2026-27");
  expect(overview.points).toBe(0);
  expect(overview.awards).toBe(0);
  expect(overview.students).toBe(1);

  // Award log and teacher activity start empty.
  expect(await getAwardLog()).toEqual([]);
  for (const teacher of await getTeacherStats()) {
    expect(teacher.points).toBe(0);
    expect(teacher.submissions).toBe(0);
  }

  // House standings and student leaderboards are back to zero.
  for (const house of await getHouseTotals()) expect(house.points).toBe(0);
  const top = await getTopStudentsByHouse(5);
  expect(Object.values(top).every((list) => list.length === 0)).toBe(true);
});

test("teachers survive the rollover — only their tallies reset", async () => {
  const teachers = await getTeacherStats();
  expect(teachers.map((t) => t.name)).toContain("A Teacher");
});

test("the archived year's rows are still in the database, not deleted", async () => {
  const rows = await db().execute(
    "SELECT COUNT(*) AS n FROM awards WHERE year_id = 1 AND voided_at IS NULL",
  );
  expect(Number(rows.rows[0].n)).toBe(2);

  const years = await db().execute("SELECT name, is_current FROM school_years ORDER BY id");
  expect(years.rows.map((r) => String(r.name))).toEqual(["2025-26", "2026-27"]);
  expect(Number(years.rows[0].is_current)).toBe(0);
});

test("the archived year is listed with its own figures", async () => {
  const years = await listSchoolYears();
  expect(years.map((y) => y.name)).toEqual(["2026-27", "2025-26"]);

  const [current, archived] = years;
  expect(current.isCurrent).toBe(true);
  expect(current.points).toBe(0);

  expect(archived.isCurrent).toBe(false);
  expect(archived.points).toBe(59);
  expect(archived.endedAt).not.toBeNull();
});

test("an archived year can still be exported after the rollover", async () => {
  const years = await listSchoolYears();
  const archived = years.find((y) => !y.isCurrent)!;

  const log = await exportAwardsCsv(archived.id);
  expect(log).toContain("OLD PUPIL");
  expect(log.trim().split("\n")).toHaveLength(3); // header + student award + house award

  const totals = await exportStudentTotalsCsv(archived.id);
  expect(totals).toContain("OLD PUPIL");
  expect(totals).toContain("9");
});

test("exporting the current year does not leak the archived one", async () => {
  const totals = await exportStudentTotalsCsv();
  expect(totals).toContain("NEW PUPIL");
  expect(totals).not.toContain("OLD PUPIL");

  const log = await exportAwardsCsv();
  expect(log.trim().split("\n")).toHaveLength(1); // header only — no awards yet
});

test("the current year cannot be removed", async () => {
  const current = (await listSchoolYears()).find((y) => y.isCurrent)!;
  const result = await deleteSchoolYear(current.id);
  expect(result.deleted).toBe(false);
  expect(result.reason).toBe("current");
  expect((await listSchoolYears()).some((y) => y.id === current.id)).toBe(true);
});

test("removing a year that is not there is reported, not thrown", async () => {
  const result = await deleteSchoolYear(9999);
  expect(result.deleted).toBe(false);
  expect(result.reason).toBe("not-found");
});

test("removing an archived year takes its students and awards with it", async () => {
  const archived = (await listSchoolYears()).find((y) => !y.isCurrent)!;
  expect(await deleteSchoolYear(archived.id)).toEqual({ deleted: true });

  expect((await listSchoolYears()).map((y) => y.id)).not.toContain(archived.id);

  // Nothing may be left pointing at a year that has gone.
  const orphanStudents = await db().execute(
    "SELECT COUNT(*) AS n FROM students WHERE year_id NOT IN (SELECT id FROM school_years)",
  );
  const orphanAwards = await db().execute(
    "SELECT COUNT(*) AS n FROM awards WHERE year_id NOT IN (SELECT id FROM school_years)",
  );
  expect(Number(orphanStudents.rows[0].n)).toBe(0);
  expect(Number(orphanAwards.rows[0].n)).toBe(0);
});

test("the current year is untouched by deleting another", async () => {
  const overview = await getOverview();
  expect(overview.yearName).toBe("2026-27");
  expect(overview.students).toBe(1);
});
