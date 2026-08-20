import { beforeAll, afterAll, test, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Point the client at a throwaway database before anything imports it.
const dir = mkdtempSync(join(tmpdir(), "housepoints-test-"));
process.env.TURSO_DATABASE_URL = `file:${join(dir, "test.db")}`;

const { db, ensureSchema } = await import("@/lib/db");
const { submitStudentAwards, getHouseTotals, submitHouseAward, voidBatch } = await import(
  "@/lib/queries"
);

let studentIds: number[] = [];
let teacherIds: number[] = [];

beforeAll(async () => {
  await ensureSchema();
  const c = db();
  await c.execute("INSERT INTO school_years (name, is_current) VALUES ('test', 1)");

  // Ten students, evenly split between two houses.
  for (let i = 0; i < 10; i++) {
    await c.execute({
      sql: `INSERT INTO students (year_id, name, class_code, house)
            VALUES (1, ?, '7.L.1E', ?)`,
      args: [`Student ${i}`, i % 2 === 0 ? "Tigers" : "Bears"],
    });
  }
  for (let i = 0; i < 8; i++) {
    await c.execute({ sql: "INSERT INTO teachers (name) VALUES (?)", args: [`Teacher ${i}`] });
  }

  studentIds = (await c.execute("SELECT id FROM students")).rows.map((r) => Number(r.id));
  teacherIds = (await c.execute("SELECT id FROM teachers")).rows.map((r) => Number(r.id));
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

/**
 * The failure that killed the spreadsheet: two teachers submitting at once,
 * one submission silently overwriting the other. Every award is its own row,
 * so concurrent writes must all survive.
 */
test("concurrent submissions from many teachers all survive", async () => {
  const perTeacher = studentIds.map((id) => ({ studentId: id, points: 1 }));

  const results = await Promise.all(
    teacherIds.map((teacherId) => submitStudentAwards(teacherId, perTeacher)),
  );

  for (const result of results) {
    expect(result.count).toBe(studentIds.length);
  }

  const totals = await getHouseTotals();
  const grand = totals.reduce((sum, t) => sum + t.points, 0);
  // 8 teachers × 10 students × 1 point, none lost.
  expect(grand).toBe(teacherIds.length * studentIds.length);

  const rows = await db().execute("SELECT COUNT(*) AS n FROM awards");
  expect(Number(rows.rows[0].n)).toBe(teacherIds.length * studentIds.length);
});

test("house awards raise only the house total and touch no student", async () => {
  const before = (await getHouseTotals()).find((t) => t.house === "Sharks")!.points;
  await submitHouseAward(teacherIds[0], "Sharks", 250);
  const after = (await getHouseTotals()).find((t) => t.house === "Sharks")!.points;

  expect(after - before).toBe(250);

  const orphaned = await db().execute(
    "SELECT COUNT(*) AS n FROM awards WHERE kind = 'house' AND student_id IS NOT NULL",
  );
  expect(Number(orphaned.rows[0].n)).toBe(0);
});

test("voiding a batch removes its points but keeps the record", async () => {
  const { batchId } = await submitStudentAwards(teacherIds[0], [
    { studentId: studentIds[0], points: 99 },
  ]);
  const withAward = (await getHouseTotals()).find((t) => t.house === "Tigers")!.points;

  const voided = await voidBatch(batchId, "tester");
  expect(voided).toBe(1);

  const afterVoid = (await getHouseTotals()).find((t) => t.house === "Tigers")!.points;
  expect(withAward - afterVoid).toBe(99);

  // The row is still there — voided, not deleted.
  const still = await db().execute({
    sql: "SELECT COUNT(*) AS n FROM awards WHERE batch_id = ?",
    args: [batchId],
  });
  expect(Number(still.rows[0].n)).toBe(1);
});

test("voiding the same batch twice does not double-count", async () => {
  const { batchId } = await submitStudentAwards(teacherIds[1], [
    { studentId: studentIds[1], points: 5 },
  ]);
  expect(await voidBatch(batchId, "tester")).toBe(1);
  expect(await voidBatch(batchId, "tester")).toBe(0);
});

test("zero and non-numeric point entries are ignored", async () => {
  const result = await submitStudentAwards(teacherIds[2], [
    { studentId: studentIds[0], points: 0 },
    { studentId: studentIds[1], points: Number.NaN },
  ]);
  expect(result.count).toBe(0);
});

test("a house switch does not move points already earned for the old house", async () => {
  const c = db();
  const movingStudent = studentIds[0]; // starts as Tigers

  await submitStudentAwards(teacherIds[3], [{ studentId: movingStudent, points: 40 }]);
  const tigersBefore = (await getHouseTotals()).find((t) => t.house === "Tigers")!.points;
  const bearsBefore = (await getHouseTotals()).find((t) => t.house === "Bears")!.points;

  await c.execute({
    sql: "UPDATE students SET house = 'Bears' WHERE id = ?",
    args: [movingStudent],
  });

  const tigersAfter = (await getHouseTotals()).find((t) => t.house === "Tigers")!.points;
  const bearsAfter = (await getHouseTotals()).find((t) => t.house === "Bears")!.points;

  expect(tigersAfter).toBe(tigersBefore);
  expect(bearsAfter).toBe(bearsBefore);

  // New points now count towards the new house.
  await submitStudentAwards(teacherIds[3], [{ studentId: movingStudent, points: 7 }]);
  const bearsFinal = (await getHouseTotals()).find((t) => t.house === "Bears")!.points;
  expect(bearsFinal - bearsBefore).toBe(7);
});

test("moving class takes the student's points to the new class", async () => {
  const { getTopClassesByHouse } = await import("@/lib/queries");
  const c = db();

  // A fresh student in their own class, so the totals are unambiguous.
  await c.execute(
    `INSERT INTO students (year_id, name, class_code, house)
     VALUES (1, 'Mover', '9.L.9Z', 'Sharks')`,
  );
  const moverId = Number(
    (await c.execute("SELECT id FROM students WHERE name = 'Mover'")).rows[0].id,
  );

  await submitStudentAwards(teacherIds[4], [{ studentId: moverId, points: 500 }]);

  const before = (await getTopClassesByHouse(20)).Sharks;
  expect(before.find((entry) => entry.classCode === "9.L.9Z")?.points).toBe(500);

  await c.execute({
    sql: "UPDATE students SET class_code = '9.L.8Y' WHERE id = ?",
    args: [moverId],
  });

  const after = (await getTopClassesByHouse(20)).Sharks;
  expect(after.find((entry) => entry.classCode === "9.L.9Z")).toBeUndefined();
  expect(after.find((entry) => entry.classCode === "9.L.8Y")?.points).toBe(500);
});
