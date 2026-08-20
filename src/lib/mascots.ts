import type { House } from "./houses";

/**
 * Mascot artwork and sounds are found by convention: a file named after the
 * house, in the public folder. Several formats are tried in turn so a crest
 * can be dropped in as whatever the artwork happens to be — a scan or photo of
 * a student drawing is far more likely to be a PNG than an SVG.
 *
 * Vector first, since it stays sharp as the mascot swells across the screen,
 * then the common raster formats in rough order of quality.
 */
const IMAGE_FORMATS = ["svg", "png", "webp", "jpg", "jpeg", "gif"] as const;

/** mp3 is universal; wav is what most free sound libraries hand you. */
const AUDIO_FORMATS = ["mp3", "wav", "ogg", "m4a"] as const;

export function mascotCandidates(house: House): string[] {
  const name = house.toLowerCase();
  return IMAGE_FORMATS.map((extension) => `/mascots/${name}.${extension}`);
}

export function soundCandidates(house: House): string[] {
  const name = house.toLowerCase();
  return AUDIO_FORMATS.map((extension) => `/sounds/${name}.${extension}`);
}
