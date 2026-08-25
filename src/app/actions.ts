"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { TEACHER_COOKIE, isAdmin } from "@/lib/auth";
import { hasAccess } from "@/lib/auth";
import { isHouse } from "@/lib/houses";
import { MAX_POINTS_PER_ENTRY, isWithinEntryLimit } from "@/lib/points";
import {
  getClassRoster,
  getRecentBatches,
  submitHouseAward,
  submitStudentAwards,
  voidBatch,
  type BatchSummary,
  type Student,
} from "@/lib/queries";

async function assertAccess(): Promise<void> {
  if (!(await hasAccess())) throw new Error("Access code required.");
}

export async function loadRoster(classCode: string): Promise<Student[]> {
  await assertAccess();
  if (!classCode) return [];
  return getClassRoster(classCode);
}

/** Remember the teacher across visits so the name is preselected next time. */
export async function rememberTeacher(teacherId: number): Promise<void> {
  const jar = await cookies();
  jar.set(TEACHER_COOKIE, String(teacherId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
}

export type SubmitResult =
  | { ok: true; batchId: string; count: number; total: number; message: string }
  | { ok: false; message: string };

export async function submitClassPoints(
  teacherId: number,
  entries: { studentId: number; points: number }[],
): Promise<SubmitResult> {
  await assertAccess();
  if (!Number.isInteger(teacherId) || teacherId <= 0) {
    return { ok: false, message: "Choose your name before submitting." };
  }

  const clean = entries.filter(
    (e) => Number.isInteger(e.studentId) && Number.isFinite(e.points) && e.points !== 0,
  );
  if (clean.length === 0) {
    return { ok: false, message: "Nothing to submit — no points entered yet." };
  }

  // Enforced here as well as on the entry screen: a disabled button is a
  // convenience, not a rule. Rejects the whole batch rather than trimming it,
  // so nothing is recorded that the teacher did not intend.
  const overLimit = clean.filter((e) => !isWithinEntryLimit(e.points));
  if (overLimit.length > 0) {
    return {
      ok: false,
      message: `Maximum ${MAX_POINTS_PER_ENTRY} points per student in one go. ${
        overLimit.length === 1 ? "One entry is" : `${overLimit.length} entries are`
      } above that — award again to give more.`,
    };
  }

  const { batchId, count, total } = await submitStudentAwards(teacherId, clean);
  if (count === 0) {
    return { ok: false, message: "Nothing to submit — no points entered yet." };
  }

  revalidatePath("/display");
  return {
    ok: true,
    batchId,
    count,
    total,
    message: `${total} ${total === 1 ? "point" : "points"} to ${count} ${
      count === 1 ? "student" : "students"
    }.`,
  };
}

export async function submitWholeHousePoints(
  teacherId: number,
  house: string,
  points: number,
): Promise<SubmitResult> {
  await assertAccess();
  if (!Number.isInteger(teacherId) || teacherId <= 0) {
    return { ok: false, message: "Choose your name before submitting." };
  }
  if (!isHouse(house)) return { ok: false, message: "Unknown house." };
  if (!Number.isFinite(points) || points === 0) {
    return { ok: false, message: "Enter a number of points first." };
  }

  const { batchId } = await submitHouseAward(teacherId, house, points);
  revalidatePath("/display");
  return {
    ok: true,
    batchId,
    count: 1,
    total: points,
    message: `${points} ${Math.abs(points) === 1 ? "point" : "points"} to ${house}.`,
  };
}

export async function undoBatch(
  batchId: string,
  teacherName: string,
): Promise<{ ok: boolean; message: string }> {
  await assertAccess();
  if (!batchId) return { ok: false, message: "Nothing to undo." };

  const rows = await voidBatch(batchId, teacherName);
  revalidatePath("/display");
  return rows > 0
    ? { ok: true, message: "Submission undone." }
    : { ok: false, message: "That submission was already undone." };
}

export async function recentForTeacher(teacherId: number): Promise<BatchSummary[]> {
  await assertAccess();
  if (!Number.isInteger(teacherId) || teacherId <= 0) return [];
  return getRecentBatches(teacherId);
}

/** Admin-only reversal of anyone's submission. */
export async function adminUndoBatch(
  batchId: string,
): Promise<{ ok: boolean; message: string }> {
  if (!(await isAdmin())) return { ok: false, message: "Not signed in as admin." };
  const rows = await voidBatch(batchId, "admin");
  revalidatePath("/display");
  revalidatePath("/admin/log");
  return rows > 0
    ? { ok: true, message: "Submission reversed." }
    : { ok: false, message: "That submission was already reversed." };
}
