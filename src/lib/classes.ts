/**
 * Class codes are `grade.campus.class` — "7.L.5I" is grade 7, class 5. The
 * trailing letter is a stream marker and carries no ordering meaning.
 *
 * Sorting these as plain text puts grade 10, 11 and 12 above grade 6, so both
 * the database and the UI order them numerically instead: grade first, then
 * class number, then the raw code to keep ties stable.
 */

/**
 * SQL fragment producing (grade, class number) for ordering. Used inside the
 * query rather than after it so that a LIMIT selects the right rows, not just
 * the alphabetically-first ones.
 *
 * SQLite's CAST reads a leading integer and yields 0 for anything unparseable,
 * which sorts odd codes to the top where they are easy to spot and fix.
 */
export const CLASS_ORDER_SQL = `
  CAST(%COL% AS INTEGER),
  CAST(
    substr(
      substr(%COL%, instr(%COL%, '.') + 1),
      instr(substr(%COL%, instr(%COL%, '.') + 1), '.') + 1
    ) AS INTEGER
  ),
  %COL% COLLATE NOCASE`;

/** Builds the ORDER BY fragment for a given column reference. */
export function classOrderBy(column: string): string {
  return CLASS_ORDER_SQL.replaceAll("%COL%", column);
}

export type ParsedClassCode = { grade: number; classNumber: number };

export function parseClassCode(code: string): ParsedClassCode {
  const parts = code.split(".");
  return {
    grade: leadingInt(parts[0] ?? ""),
    classNumber: leadingInt(parts[2] ?? ""),
  };
}

function leadingInt(value: string): number {
  const match = /^\s*(\d+)/.exec(value);
  return match ? Number(match[1]) : 0;
}

/** Same ordering as `classOrderBy`, for sorting lists already in memory. */
export function compareClassCodes(a: string, b: string): number {
  const left = parseClassCode(a);
  const right = parseClassCode(b);
  return (
    left.grade - right.grade ||
    left.classNumber - right.classNumber ||
    a.localeCompare(b)
  );
}
