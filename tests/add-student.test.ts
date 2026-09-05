import { beforeAll, afterAll, test, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "housepoints-add-"));
process.env.TURSO_DATABASE_URL = `file:${join(dir, "test.db")}`;

const { db, ensureSchema } = await import("@/lib/db");
const { addStudent } = await import("@/lib/roster");
const { getClassRoster, getClassCodes } = await import("@/lib/queries");

beforeAll(async () => {
  await ensureSchema();
  await db().execute("INSERT INTO school_years (name, is_current) VALUES ('test', 1)");
  await db().execute(
    "INSERT INTO students (year_id, name, class_code, house) VALUES (1, 'EXISTING PUPIL', '7.L.2A', 'Bears')",
  );
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

test("adds a mid-year arrival to an existing class", async () => {
  const id = await addStudent({
    name: "NEW ARRIVAL",
    classCode: "7.L.2A",
    house: "Tigers",
  });
  expect(id).not.toBeNull();

  const roster = await getClassRoster("7.L.2A");
  expect(roster.map((s) => s.name)).toContain("NEW ARRIVAL");
  expect(roster.find((s) => s.name === "NEW ARRIVAL")?.house).toBe("Tigers");
});

test("a new student starts on zero points", async () => {
  const rows = await db().execute(
    "SELECT COUNT(*) AS n FROM awards WHERE student_id = (SELECT id FROM students WHERE name = 'NEW ARRIVAL')",
  );
  expect(Number(rows.rows[0].n)).toBe(0);
});

test("refuses a duplicate name in the same class rather than creating two", async () => {
  const again = await addStudent({
    name: "new arrival",
    classCode: "7.l.2a",
    house: "Tigers",
  });
  // Matched case-insensitively, so a re-typed name does not slip through.
  expect(again).toBeNull();
});

test("allows the same name in a different class", async () => {
  const id = await addStudent({
    name: "NEW ARRIVAL",
    classCode: "9.L.1E",
    house: "Sharks",
  });
  expect(id).not.toBeNull();
});

test("a brand-new class code appears in the class list", async () => {
  await addStudent({ name: "TRANSFER PUPIL", classCode: "6.L.9Z", house: "Eagles" });
  expect(await getClassCodes()).toContain("6.L.9Z");
});

test("trims stray whitespace from pasted names", async () => {
  await addStudent({ name: "  SPACED NAME  ", classCode: "7.L.2A", house: "Bears" });
  const roster = await getClassRoster("7.L.2A");
  expect(roster.map((s) => s.name)).toContain("SPACED NAME");
});
