/**
 * The most that can be given to one student in a single entry. School policy,
 * set for the 2026-27 relaunch: no more than ten house points per student per
 * lesson.
 *
 * It is a cap on one entry rather than a daily or weekly total. A teacher
 * catching up on a busy week simply submits more than once, which keeps the
 * limit meaningful without getting in the way of legitimate backfilling.
 *
 * Whole-house awards are deliberately not capped — those are occasional,
 * deliberate acts rather than routine classroom marks.
 */
export const MAX_POINTS_PER_ENTRY = 10;

/**
 * Checked by magnitude so a mistyped -50 is caught as readily as 50. Shared by
 * the entry screen and the server action so the two cannot drift apart.
 */
export function isWithinEntryLimit(points: number): boolean {
  return Number.isFinite(points) && Math.abs(points) <= MAX_POINTS_PER_ENTRY;
}
