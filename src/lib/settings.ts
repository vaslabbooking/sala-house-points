import { db, ensureSchema } from "./db";

export const SETTING = {
  accessCodeEnabled: "access_code_enabled",
  accessCode: "access_code",
  adminPasswordHash: "admin_password_hash",
  publicDisplay: "display_public",
  animateDisplay: "display_animate",
  mascotBurst: "display_mascot",
  mascotSound: "display_sound",
} as const;

export async function getSetting(key: string): Promise<string | null> {
  await ensureSchema();
  const res = await db().execute({
    sql: "SELECT value FROM settings WHERE key = ?",
    args: [key],
  });
  return res.rows.length ? String(res.rows[0].value) : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await ensureSchema();
  await db().execute({
    sql: `INSERT INTO settings (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    args: [key, value],
  });
}

/**
 * The academic year everything is scoped to. Created on first run so a fresh
 * deployment is usable without a setup step; "Start New Year" in admin closes
 * the current one and opens the next.
 */
export async function getCurrentYear(): Promise<{ id: number; name: string }> {
  await ensureSchema();
  const c = db();
  const found = await c.execute(
    "SELECT id, name FROM school_years WHERE is_current = 1 LIMIT 1",
  );
  if (found.rows.length) {
    return { id: Number(found.rows[0].id), name: String(found.rows[0].name) };
  }
  const name = defaultYearName();
  const created = await c.execute({
    sql: "INSERT INTO school_years (name, is_current) VALUES (?, 1) RETURNING id",
    args: [name],
  });
  return { id: Number(created.rows[0].id), name };
}

/** e.g. "2026-27" — the academic year runs August to July. */
export function defaultYearName(now: Date = new Date()): string {
  const year = now.getFullYear();
  const startYear = now.getMonth() >= 7 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}
