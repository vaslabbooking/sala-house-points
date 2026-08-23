import { test, expect } from "vitest";
import { flagFromSetting, defaultYearName } from "@/lib/settings";

test("reads stored flags", () => {
  expect(flagFromSetting("1", false)).toBe(true);
  expect(flagFromSetting("0", true)).toBe(false);
});

test("falls back to the caller's default when nothing is stored", () => {
  // Mascot burst defaults on, mascot sound defaults off — an unset value must
  // not collapse them both to the same answer.
  expect(flagFromSetting(null, true)).toBe(true);
  expect(flagFromSetting(null, false)).toBe(false);
});

test("treats an unexpected stored value as unset rather than true", () => {
  expect(flagFromSetting("", true)).toBe(true);
  expect(flagFromSetting("yes", false)).toBe(false);
});

test("names the academic year from August", () => {
  expect(defaultYearName(new Date("2026-08-01T00:00:00Z"))).toBe("2026-27");
  expect(defaultYearName(new Date("2027-07-31T00:00:00Z"))).toBe("2026-27");
  expect(defaultYearName(new Date("2027-09-01T00:00:00Z"))).toBe("2027-28");
});
