import { createClient, type Client } from "@libsql/client";

/**
 * One libSQL client for the process. In production this points at Turso; with
 * no TURSO_DATABASE_URL set it falls back to a local SQLite file so the app
 * runs identically in development.
 */
let client: Client | null = null;
let migrated: Promise<void> | null = null;

function createDbClient(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    // A deployed host has a read-only filesystem, so falling back to a local
    // SQLite file there fails deep inside the driver with nothing useful to go
    // on. Say plainly what is missing instead.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "TURSO_DATABASE_URL is not set. Add it (and TURSO_AUTH_TOKEN) to the " +
          "site's environment variables, then redeploy.",
      );
    }
    return createClient({ url: "file:data/housepoints.db" });
  }
  return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
}

export function db(): Client {
  if (!client) client = createDbClient();
  return client;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS school_years (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     name        TEXT    NOT NULL,
     is_current  INTEGER NOT NULL DEFAULT 0,
     started_at  TEXT    NOT NULL DEFAULT (datetime('now')),
     ended_at    TEXT
   )`,

  `CREATE TABLE IF NOT EXISTS students (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     year_id     INTEGER NOT NULL REFERENCES school_years(id),
     name        TEXT    NOT NULL,
     class_code  TEXT    NOT NULL,
     house       TEXT    NOT NULL,
     external_id TEXT,
     active      INTEGER NOT NULL DEFAULT 1,
     created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
   )`,

  `CREATE TABLE IF NOT EXISTS teachers (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     name        TEXT    NOT NULL,
     active      INTEGER NOT NULL DEFAULT 1,
     created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
   )`,

  /*
   * The ledger. One row per award, never updated except to void it.
   * `house` and `class_code` are snapshots taken when the award was given:
   * house totals are therefore historically fixed (a student switching house
   * does not drag old points across), while a student's own total follows
   * them by student_id wherever they move.
   * student_id is NULL for whole-house awards (kind = 'house').
   */
  `CREATE TABLE IF NOT EXISTS awards (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     year_id     INTEGER NOT NULL REFERENCES school_years(id),
     batch_id    TEXT    NOT NULL,
     kind        TEXT    NOT NULL CHECK (kind IN ('student','house')),
     teacher_id  INTEGER NOT NULL REFERENCES teachers(id),
     student_id  INTEGER REFERENCES students(id),
     house       TEXT    NOT NULL,
     class_code  TEXT,
     points      INTEGER NOT NULL,
     note        TEXT,
     created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
     voided_at   TEXT,
     voided_by   TEXT,
     CHECK ((kind = 'house' AND student_id IS NULL)
         OR (kind = 'student' AND student_id IS NOT NULL))
   )`,

  `CREATE TABLE IF NOT EXISTS settings (
     key   TEXT PRIMARY KEY,
     value TEXT NOT NULL
   )`,

  `CREATE INDEX IF NOT EXISTS idx_students_year   ON students (year_id, active)`,
  `CREATE INDEX IF NOT EXISTS idx_students_class  ON students (year_id, class_code)`,
  `CREATE INDEX IF NOT EXISTS idx_awards_live     ON awards (year_id, voided_at)`,
  `CREATE INDEX IF NOT EXISTS idx_awards_student  ON awards (student_id, voided_at)`,
  `CREATE INDEX IF NOT EXISTS idx_awards_teacher  ON awards (teacher_id, voided_at)`,
  `CREATE INDEX IF NOT EXISTS idx_awards_batch    ON awards (batch_id)`,
];

/**
 * Idempotent schema setup, run once per process before the first query.
 */
export async function ensureSchema(): Promise<void> {
  if (!migrated) {
    migrated = (async () => {
      const c = db();
      for (const statement of SCHEMA) {
        await c.execute(statement);
      }
    })().catch((err) => {
      // Let the next call retry rather than caching a failed migration.
      migrated = null;
      throw err;
    });
  }
  return migrated;
}
