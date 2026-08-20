import { test, expect } from "vitest";
import { mascotCandidates, soundCandidates } from "@/lib/mascots";
import { HOUSES } from "@/lib/houses";

test("looks for mascot artwork by house name in lower case", () => {
  expect(mascotCandidates("Bears")[0]).toBe("/mascots/bears.svg");
  expect(mascotCandidates("Tigers")[0]).toBe("/mascots/tigers.svg");
});

test("tries vector first, then the common raster formats", () => {
  const candidates = mascotCandidates("Sharks");
  expect(candidates[0]).toBe("/mascots/sharks.svg");
  expect(candidates).toContain("/mascots/sharks.png");
  expect(candidates).toContain("/mascots/sharks.webp");
  expect(candidates).toContain("/mascots/sharks.jpg");
  // A scanned crest should not need converting before it works.
  expect(candidates.indexOf("/mascots/sharks.svg")).toBeLessThan(
    candidates.indexOf("/mascots/sharks.png"),
  );
});

test("offers a sound candidate for every house, mp3 first", () => {
  for (const house of HOUSES) {
    const candidates = soundCandidates(house);
    expect(candidates[0]).toBe(`/sounds/${house.toLowerCase()}.mp3`);
    expect(candidates).toContain(`/sounds/${house.toLowerCase()}.wav`);
  }
});

test("every house resolves to a distinct set of files", () => {
  const firsts = HOUSES.map((house) => mascotCandidates(house)[0]);
  expect(new Set(firsts).size).toBe(HOUSES.length);
});
