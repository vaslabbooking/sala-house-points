"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  grantAdmin,
  hashPassword,
  isAdmin,
  revokeAdmin,
  verifyPassword,
} from "@/lib/auth";
import { SETTING, getFlag, getSetting, setSetting } from "@/lib/settings";
import { isHouse, type House } from "@/lib/houses";
import {
  addStudent,
  addTeacher,
  deleteSchoolYear,
  moveStudent,
  parseRosterCsv,
  setStudentActive,
  setTeacherActive,
  startNewYear,
} from "@/lib/roster";

export type ActionResult = { ok: boolean; message: string };

async function guard(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Not signed in as admin.");
}

export async function adminPasswordIsSet(): Promise<boolean> {
  return !!(await getSetting(SETTING.adminPasswordHash));
}

/** First run: no password exists yet, so the first person here sets one. */
export async function setUpAdminPassword(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (await adminPasswordIsSet()) redirect("/admin/login?error=exists");
  if (password.length < 8) redirect("/admin/login?error=short");
  if (password !== confirm) redirect("/admin/login?error=match");

  await setSetting(SETTING.adminPasswordHash, hashPassword(password));
  await grantAdmin();
  redirect("/admin");
}

export async function adminLogin(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  const stored = await getSetting(SETTING.adminPasswordHash);
  if (!stored || !verifyPassword(password, stored)) {
    redirect("/admin/login?error=wrong");
  }
  await grantAdmin();
  redirect("/admin");
}

export async function adminLogout(): Promise<void> {
  await revokeAdmin();
  redirect("/");
}

export async function changeAdminPassword(
  current: string,
  next: string,
): Promise<ActionResult> {
  await guard();
  const stored = await getSetting(SETTING.adminPasswordHash);
  if (!stored || !verifyPassword(current, stored)) {
    return { ok: false, message: "Current password is not correct." };
  }
  if (next.length < 8) {
    return { ok: false, message: "New password must be at least 8 characters." };
  }
  await setSetting(SETTING.adminPasswordHash, hashPassword(next));
  return { ok: true, message: "Admin password changed." };
}

export type AccessSettings = { enabled: boolean; code: string };

/**
 * Takes and returns plain values rather than FormData. The form-action route
 * made React reset the form after saving, which snapped controlled checkboxes
 * back to their pre-save state and made a successful save look like it failed.
 * Returning what was actually persisted lets the UI show the stored truth.
 */
export async function saveAccessCode(
  next: AccessSettings,
): Promise<ActionResult & { settings: AccessSettings }> {
  await guard();
  const code = next.code.trim().toUpperCase();
  const current = async (): Promise<AccessSettings> => ({
    enabled: await getFlag(SETTING.accessCodeEnabled, false),
    code: (await getSetting(SETTING.accessCode)) ?? "",
  });

  if (next.enabled && code.length < 4) {
    return {
      ok: false,
      message: "Access code must be at least 4 characters.",
      settings: await current(),
    };
  }

  await setSetting(SETTING.accessCode, code);
  await setSetting(SETTING.accessCodeEnabled, next.enabled ? "1" : "0");
  revalidatePath("/admin/settings");
  revalidatePath("/display");

  return {
    ok: true,
    message: next.enabled
      ? `Staff access code is now "${code}".`
      : "Access code turned off — anyone with the link can award points.",
    settings: await current(),
  };
}

export type DisplaySettings = {
  animate: boolean;
  mascot: boolean;
  sound: boolean;
  publicDisplay: boolean;
};

/** Reads the values back after writing, so the UI reflects what is stored. */
export async function saveDisplaySettings(
  next: DisplaySettings,
): Promise<ActionResult & { settings: DisplaySettings }> {
  await guard();

  await setSetting(SETTING.publicDisplay, next.publicDisplay ? "1" : "0");
  await setSetting(SETTING.animateDisplay, next.animate ? "1" : "0");
  await setSetting(SETTING.mascotBurst, next.mascot ? "1" : "0");
  await setSetting(SETTING.mascotSound, next.sound ? "1" : "0");
  revalidatePath("/admin/settings");
  revalidatePath("/display");

  return {
    ok: true,
    message: "Leaderboard settings saved.",
    settings: {
      animate: await getFlag(SETTING.animateDisplay, true),
      mascot: await getFlag(SETTING.mascotBurst, true),
      sound: await getFlag(SETTING.mascotSound, false),
      publicDisplay: await getFlag(SETTING.publicDisplay, false),
    },
  };
}

/* ---------------- roster ---------------- */

export type ImportPreview = {
  ok: boolean;
  message: string;
  students: number;
  classes: number;
  houseCounts: Record<string, number>;
  errors: string[];
  csv?: string;
};

/**
 * Parses and reports without writing anything, so an unbalanced or malformed
 * roster can be spotted before it replaces the real one.
 */
export async function previewRosterCsv(formData: FormData): Promise<ImportPreview> {
  await guard();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return {
      ok: false,
      message: "Choose a CSV file first.",
      students: 0,
      classes: 0,
      houseCounts: {},
      errors: [],
    };
  }
  const csv = await file.text();
  const parsed = parseRosterCsv(csv);
  return {
    ok: parsed.students.length > 0,
    message:
      parsed.students.length > 0
        ? `Ready to import ${parsed.students.length} students across ${parsed.classCount} classes.`
        : "No usable rows found.",
    students: parsed.students.length,
    classes: parsed.classCount,
    houseCounts: parsed.houseCounts,
    errors: parsed.errors,
    csv: parsed.students.length > 0 ? csv : undefined,
  };
}

export async function commitStartNewYear(
  csv: string,
  yearName: string,
): Promise<ActionResult> {
  await guard();
  const parsed = parseRosterCsv(csv);
  if (parsed.students.length === 0) {
    return { ok: false, message: "Nothing to import." };
  }
  const result = await startNewYear(parsed.students, yearName);
  revalidatePath("/");
  revalidatePath("/display");
  revalidatePath("/admin");
  return {
    ok: true,
    message: `Started ${result.name} with ${result.students} students. All points are back to zero; last year's records are kept.`,
  };
}

export async function removeSchoolYear(yearId: number): Promise<ActionResult> {
  await guard();
  if (!Number.isInteger(yearId) || yearId <= 0) {
    return { ok: false, message: "Unknown school year." };
  }

  const result = await deleteSchoolYear(yearId);
  if (!result.deleted) {
    return {
      ok: false,
      message:
        result.reason === "current"
          ? "That is the current year, so it cannot be deleted. Start a new year first."
          : "That school year no longer exists.",
    };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  return { ok: true, message: "School year deleted." };
}

export async function createStudent(student: {
  name: string;
  classCode: string;
  house: string;
}): Promise<ActionResult> {
  await guard();

  const name = student.name.trim();
  const classCode = student.classCode.trim();
  if (!name) return { ok: false, message: "Enter the student's name." };
  if (!classCode) return { ok: false, message: "Enter a class." };
  if (!isHouse(student.house)) return { ok: false, message: "Choose a house." };

  const id = await addStudent({ name, classCode, house: student.house });
  if (id === null) {
    return {
      ok: false,
      message: `${name} is already in ${classCode}. If this is a different student with the same name, add something to tell them apart.`,
    };
  }

  revalidatePath("/admin/roster");
  revalidatePath("/");
  revalidatePath("/display");
  return { ok: true, message: `${name} added to ${classCode} (${student.house}).` };
}

export async function updateStudent(
  studentId: number,
  classCode: string,
  house: string,
): Promise<ActionResult> {
  await guard();
  if (!isHouse(house)) return { ok: false, message: "Unknown house." };
  if (!classCode.trim()) return { ok: false, message: "Class cannot be blank." };

  await moveStudent(studentId, { classCode, house: house as House });
  revalidatePath("/admin/roster");
  revalidatePath("/display");
  return { ok: true, message: "Student updated." };
}

export async function toggleStudent(
  studentId: number,
  active: boolean,
): Promise<ActionResult> {
  await guard();
  await setStudentActive(studentId, active);
  revalidatePath("/admin/roster");
  return {
    ok: true,
    message: active ? "Student restored." : "Student removed from the roster.",
  };
}

/* ---------------- teachers ---------------- */

export async function createTeacher(formData: FormData): Promise<ActionResult> {
  await guard();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Enter a name." };
  await addTeacher(name);
  revalidatePath("/admin/teachers");
  revalidatePath("/");
  return { ok: true, message: `${name} added.` };
}

export async function toggleTeacher(
  teacherId: number,
  active: boolean,
): Promise<ActionResult> {
  await guard();
  await setTeacherActive(teacherId, active);
  revalidatePath("/admin/teachers");
  revalidatePath("/");
  return {
    ok: true,
    message: active ? "Teacher restored." : "Teacher removed from the list.",
  };
}
