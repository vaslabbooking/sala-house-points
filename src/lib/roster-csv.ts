import { parse } from "csv-parse/sync";
import { HOUSES, isHouse, type House } from "./houses";

export type ParsedStudent = {
  name: string;
  classCode: string;
  house: House;
  externalId?: string;
};

export type ParseResult = {
  students: ParsedStudent[];
  errors: string[];
  /** Counts per house, so an unbalanced import is visible before committing. */
  houseCounts: Record<House, number>;
  classCount: number;
};

/** Header spellings we accept, so an export doesn't have to be renamed by hand. */
const COLUMN_ALIASES: Record<string, string[]> = {
  name: ["name", "student", "student name", "full name", "studentname"],
  classCode: ["class", "class code", "classcode", "form", "class_code"],
  house: ["house", "house name"],
  externalId: ["id", "student id", "studentid", "external id", "code"],
};

function resolveColumns(header: string[]): Record<string, number> {
  const normalised = header.map((h) => h.trim().toLowerCase().replace(/\s+/g, " "));
  const map: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    const index = normalised.findIndex((h) => aliases.includes(h));
    if (index >= 0) map[field] = index;
  }
  return map;
}

/**
 * Tolerant CSV reader: accepts any column order, common header spellings, and
 * house names in any case. Everything that cannot be read is reported rather
 * than silently dropped, because a half-imported roster is worse than none.
 */
export function parseRosterCsv(csv: string): ParseResult {
  const errors: string[] = [];
  const students: ParsedStudent[] = [];

  let rows: string[][];
  try {
    rows = parse(csv, {
      skip_empty_lines: true,
      relax_column_count: true,
      bom: true,
      trim: true,
    }) as string[][];
  } catch {
    return {
      students: [],
      errors: ["That file could not be read as CSV."],
      houseCounts: emptyCounts(),
      classCount: 0,
    };
  }

  if (rows.length === 0) {
    return {
      students: [],
      errors: ["The file is empty."],
      houseCounts: emptyCounts(),
      classCount: 0,
    };
  }

  const columns = resolveColumns(rows[0]);
  const missing = ["name", "classCode", "house"].filter((f) => !(f in columns));
  if (missing.length > 0) {
    return {
      students: [],
      errors: [
        `Missing column${missing.length > 1 ? "s" : ""}: ${missing
          .map((m) => (m === "classCode" ? "class" : m))
          .join(", ")}. Expected headers: name, class, house.`,
      ],
      houseCounts: emptyCounts(),
      classCount: 0,
    };
  }

  const seen = new Set<string>();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const lineNo = i + 1;
    const name = (row[columns.name] ?? "").trim();
    const classCode = (row[columns.classCode] ?? "").trim();
    const houseRaw = (row[columns.house] ?? "").trim();
    const externalId =
      columns.externalId !== undefined ? (row[columns.externalId] ?? "").trim() : "";

    if (!name && !classCode && !houseRaw) continue; // stray blank line

    if (!name) {
      errors.push(`Line ${lineNo}: missing student name.`);
      continue;
    }
    if (!classCode) {
      errors.push(`Line ${lineNo}: "${name}" has no class.`);
      continue;
    }

    const house = matchHouse(houseRaw);
    if (!house) {
      errors.push(
        `Line ${lineNo}: "${name}" has house "${houseRaw || "(blank)"}" — must be one of ${HOUSES.join(", ")}.`,
      );
      continue;
    }

    const key = `${name.toLowerCase()}|${classCode.toLowerCase()}`;
    if (seen.has(key)) {
      errors.push(`Line ${lineNo}: "${name}" appears twice in ${classCode}.`);
      continue;
    }
    seen.add(key);

    students.push({ name, classCode, house, externalId: externalId || undefined });
  }

  const houseCounts = emptyCounts();
  const classes = new Set<string>();
  for (const s of students) {
    houseCounts[s.house]++;
    classes.add(s.classCode);
  }

  return { students, errors, houseCounts, classCount: classes.size };
}

function matchHouse(value: string): House | null {
  const trimmed = value.trim();
  if (isHouse(trimmed)) return trimmed;
  const found = HOUSES.find((h) => h.toLowerCase() === trimmed.toLowerCase());
  return found ?? null;
}

function emptyCounts(): Record<House, number> {
  return Object.fromEntries(HOUSES.map((h) => [h, 0])) as Record<House, number>;
}
