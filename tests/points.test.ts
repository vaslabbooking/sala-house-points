import { test, expect } from "vitest";
import { MAX_POINTS_PER_ENTRY, isWithinEntryLimit } from "@/lib/points";

test("allows anything up to the limit", () => {
  for (const points of [1, 5, 9, MAX_POINTS_PER_ENTRY]) {
    expect(isWithinEntryLimit(points)).toBe(true);
  }
});

test("rejects anything above it", () => {
  for (const points of [11, 25, 1000]) {
    expect(isWithinEntryLimit(points)).toBe(false);
  }
});

test("ten is allowed and eleven is not", () => {
  expect(isWithinEntryLimit(10)).toBe(true);
  expect(isWithinEntryLimit(11)).toBe(false);
});

test("applies the same limit to negative entries", () => {
  // A mistyped -50 is as much an error as 50.
  expect(isWithinEntryLimit(-10)).toBe(true);
  expect(isWithinEntryLimit(-11)).toBe(false);
});

test("rejects values that are not real numbers", () => {
  for (const points of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    expect(isWithinEntryLimit(points)).toBe(false);
  }
});
