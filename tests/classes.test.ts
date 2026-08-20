import { test, expect } from "vitest";
import { compareClassCodes, parseClassCode } from "@/lib/classes";

test("reads grade and class number out of a code", () => {
  expect(parseClassCode("7.L.5I")).toEqual({ grade: 7, classNumber: 5 });
  expect(parseClassCode("12.L.3I")).toEqual({ grade: 12, classNumber: 3 });
});

test("orders grade 6 first and grade 12 last, not alphabetically", () => {
  const codes = [
    "10.L.1E",
    "12.L.3I",
    "6.L.7I",
    "11.L.4I",
    "6.L.1E",
    "7.L.5I",
    "9.L.2A",
  ];
  expect([...codes].sort(compareClassCodes)).toEqual([
    "6.L.1E",
    "6.L.7I",
    "7.L.5I",
    "9.L.2A",
    "10.L.1E",
    "11.L.4I",
    "12.L.3I",
  ]);
});

test("orders class numbers within a grade numerically", () => {
  const codes = ["6.L.7I", "6.L.10A", "6.L.2E", "6.L.1E"];
  expect([...codes].sort(compareClassCodes)).toEqual([
    "6.L.1E",
    "6.L.2E",
    "6.L.7I",
    "6.L.10A",
  ]);
});

test("sorts the real 33-class list into grade order", () => {
  const real = [
    "10.L.1E", "10.L.2A", "10.L.3I", "10.L.4I",
    "11.L.1E", "11.L.2E", "11.L.3I", "11.L.4I",
    "12.L.1E", "12.L.2E", "12.L.3I",
    "6.L.1E", "6.L.2E", "6.L.3A", "6.L.4A", "6.L.5I", "6.L.6I", "6.L.7I",
    "7.L.1E", "7.L.2A", "7.L.3A", "7.L.4I", "7.L.5I",
    "8.L.1E", "8.L.2A", "8.L.3A", "8.L.4I", "8.L.5I", "8.L.6I",
    "9.L.1E", "9.L.2A", "9.L.3I", "9.L.4I",
  ];
  const sorted = [...real].sort(compareClassCodes);
  expect(sorted[0]).toBe("6.L.1E");
  expect(sorted.at(-1)).toBe("12.L.3I");
  expect(sorted.map((c) => parseClassCode(c).grade)).toEqual(
    [...sorted.map((c) => parseClassCode(c).grade)].sort((a, b) => a - b),
  );
});

test("does not throw on a code that breaks the pattern", () => {
  expect(() => compareClassCodes("odd-code", "6.L.1E")).not.toThrow();
  expect(parseClassCode("odd-code")).toEqual({ grade: 0, classNumber: 0 });
});
