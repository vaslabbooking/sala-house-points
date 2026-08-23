import { test, expect } from "vitest";
import { resolveDisplayOptions, type DisplayOptions } from "@/lib/display-options";

const defaults: DisplayOptions = { animate: true, mascot: true, sound: true };

test("uses the school-wide defaults when the URL says nothing", () => {
  expect(resolveDisplayOptions({}, defaults)).toEqual(defaults);
});

test("quiet turns the whole screen off without touching the defaults", () => {
  expect(resolveDisplayOptions({ quiet: "1" }, defaults)).toEqual({
    animate: false,
    mascot: false,
    sound: false,
  });
  // The defaults object itself must not be mutated — other screens rely on it.
  expect(defaults).toEqual({ animate: true, mascot: true, sound: true });
});

test("a bare ?quiet with no value still counts", () => {
  expect(resolveDisplayOptions({ quiet: "" }, defaults).animate).toBe(false);
});

test("individual settings override quiet", () => {
  expect(resolveDisplayOptions({ quiet: "1", mascot: "1" }, defaults)).toEqual({
    animate: false,
    mascot: true,
    sound: false,
  });
});

test("silences just the sound on a screen that should still animate", () => {
  expect(resolveDisplayOptions({ sound: "0" }, defaults)).toEqual({
    animate: true,
    mascot: true,
    sound: false,
  });
});

test("accepts the spellings someone might actually type", () => {
  for (const off of ["0", "off", "false", "no", "OFF", " No "]) {
    expect(resolveDisplayOptions({ animate: off }, defaults).animate).toBe(false);
  }
  for (const on of ["1", "on", "true", "yes"]) {
    expect(
      resolveDisplayOptions({ quiet: "1", animate: on }, defaults).animate,
    ).toBe(true);
  }
});

test("a repeated parameter uses the first value rather than throwing", () => {
  expect(resolveDisplayOptions({ animate: ["0", "1"] }, defaults).animate).toBe(false);
});

test("a screen cannot switch sound on when the school default is off", () => {
  // Not a restriction — just confirming the URL is an override in both
  // directions, so an auditorium can opt in even if the default is silent.
  const silent: DisplayOptions = { animate: true, mascot: true, sound: false };
  expect(resolveDisplayOptions({ sound: "1" }, silent).sound).toBe(true);
});
