import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SETTING, getSetting } from "./settings";

export const ACCESS_COOKIE = "hp_access";
export const ADMIN_COOKIE = "hp_admin";
export const TEACHER_COOKIE = "hp_teacher";

/** Staff type the access code once a term, so the cookie is long-lived. */
const ACCESS_MAX_AGE = 60 * 60 * 24 * 180;
/** Admin sessions are deliberately short — this is the screen that can wipe a year. */
const ADMIN_MAX_AGE = 60 * 60 * 8;

function secret(): string {
  const value = process.env.APP_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_SECRET must be set in production");
  }
  return "dev-only-insecure-secret";
}

function sign(payload: string): string {
  const mac = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

function verify(token: string | undefined): string | null {
  if (!token) return null;
  const index = token.lastIndexOf(".");
  if (index < 1) return null;
  const payload = token.slice(0, index);
  const expected = sign(payload);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return payload;
}

/* ---------- admin password ---------- */

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password.normalize("NFKC"), salt, 64);
  return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltPart, hashPart] = stored.split("$");
  if (scheme !== "scrypt" || !saltPart || !hashPart) return false;
  const salt = Buffer.from(saltPart, "base64url");
  const expected = Buffer.from(hashPart, "base64url");
  const derived = scryptSync(password.normalize("NFKC"), salt, expected.length);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/* ---------- shared access code ---------- */

export async function accessCodeRequired(): Promise<boolean> {
  const enabled = await getSetting(SETTING.accessCodeEnabled);
  const code = await getSetting(SETTING.accessCode);
  return enabled === "1" && !!code;
}

export async function hasAccess(): Promise<boolean> {
  if (!(await accessCodeRequired())) return true;
  const jar = await cookies();
  return verify(jar.get(ACCESS_COOKIE)?.value) === "ok";
}

export async function checkAccessCode(candidate: string): Promise<boolean> {
  const code = await getSetting(SETTING.accessCode);
  if (!code) return false;
  const a = Buffer.from(candidate.trim().toUpperCase());
  const b = Buffer.from(code.trim().toUpperCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function grantAccess(): Promise<void> {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, sign("ok"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ACCESS_MAX_AGE,
    path: "/",
  });
}

/* ---------- admin session ---------- */

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return verify(jar.get(ADMIN_COOKIE)?.value) === "admin";
}

export async function grantAdmin(): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, sign("admin"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ADMIN_MAX_AGE,
    path: "/",
  });
}

export async function revokeAdmin(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

/* ---------- remembered teacher ---------- */

/**
 * Not a credential — purely so a teacher's name is preselected next time.
 * Unsigned on purpose: the entry screen re-validates the id against the roster.
 */
export async function rememberedTeacherId(): Promise<number | null> {
  const jar = await cookies();
  const raw = jar.get(TEACHER_COOKIE)?.value;
  const id = raw ? Number(raw) : NaN;
  return Number.isInteger(id) ? id : null;
}
