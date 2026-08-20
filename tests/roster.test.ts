import { test, expect } from "vitest";
import { parseRosterCsv } from "@/lib/roster-csv";

test("reads a well-formed roster", () => {
  const r = parseRosterCsv(`name,class,house
TRẦN KIM PHÚC AN,6.L.1E,Sharks
NGUYỄN HÀ MINH ĐỨC,6.L.1E,Eagles`);
  expect(r.students).toHaveLength(2);
  expect(r.errors).toEqual([]);
  expect(r.classCount).toBe(1);
  expect(r.students[0]).toEqual({
    name: "TRẦN KIM PHÚC AN",
    classCode: "6.L.1E",
    house: "Sharks",
    externalId: undefined,
  });
});

test("keeps names that contain commas intact", () => {
  const r = parseRosterCsv(`name,class,house
"Thùy, Nguyễn Thị Thanh",7.L.2A,Tigers`);
  expect(r.students).toHaveLength(1);
  expect(r.students[0].name).toBe("Thùy, Nguyễn Thị Thanh");
});

test("accepts any column order, alternative headers and odd casing", () => {
  const r = parseRosterCsv(`House,Student Name,Class,Notes
tigers,LE VAN A,8.L.1E,ignore me
BEARS,TRAN THI B,8.L.1E,x`);
  expect(r.students).toHaveLength(2);
  expect(r.students[0].house).toBe("Tigers");
  expect(r.students[1].house).toBe("Bears");
});

test("reports bad rows instead of importing them", () => {
  const r = parseRosterCsv(`name,class,house
GOOD STUDENT,9.L.1E,Bears
BAD HOUSE,9.L.1E,Dragons
,9.L.1E,Bears
NO CLASS,,Bears
GOOD STUDENT,9.L.1E,Bears`);
  expect(r.students).toHaveLength(1);
  expect(r.errors).toHaveLength(4);
  expect(r.errors.join(" ")).toMatch(/Dragons/);
  expect(r.errors.join(" ")).toMatch(/appears twice/);
});

test("refuses a file missing a required column", () => {
  const r = parseRosterCsv(`name,house
X,Bears`);
  expect(r.students).toHaveLength(0);
  expect(r.errors[0]).toMatch(/Missing column: class/);
});

test("survives a BOM, CRLF line endings and blank lines", () => {
  const r = parseRosterCsv("﻿name,class,house\r\nA STUDENT,6.L.2E,Eagles\r\n\r\n");
  expect(r.students).toHaveLength(1);
  expect(r.errors).toEqual([]);
});

test("picks up an optional student id when present", () => {
  const r = parseRosterCsv(`id,name,class,house
C123,SOME STUDENT,10.L.1E,Sharks`);
  expect(r.students[0].externalId).toBe("C123");
});

test("reports an empty file rather than throwing", () => {
  const r = parseRosterCsv("");
  expect(r.students).toHaveLength(0);
  expect(r.errors).toHaveLength(1);
});

test("counts houses so an unbalanced import is visible", () => {
  const r = parseRosterCsv(`name,class,house
A,6.L.1E,Tigers
B,6.L.1E,Tigers
C,6.L.1E,Bears`);
  expect(r.houseCounts).toEqual({ Bears: 1, Eagles: 0, Sharks: 0, Tigers: 2 });
});
