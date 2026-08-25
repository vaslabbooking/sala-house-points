"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  loadRoster,
  recentForTeacher,
  rememberTeacher,
  submitClassPoints,
  submitWholeHousePoints,
  undoBatch,
} from "@/app/actions";
import { HOUSES, HOUSE_THEME, type House } from "@/lib/houses";
import { MAX_POINTS_PER_ENTRY, isWithinEntryLimit } from "@/lib/points";
import type { BatchSummary, Student, Teacher } from "@/lib/queries";
import { HouseBadge } from "./HouseBadge";

type Flash = { message: string; tone: "ok" | "error"; batchId?: string } | null;

/** Shortcuts for the common awards; the free input still accepts anything. */
const QUICK_STEPS = [1, 2, 5];

/**
 * School policy caps a single entry at ten points per student. Anything above
 * turns pink and blocks submitting until it is corrected; to give more, submit
 * and award again.
 */
function overLimit(value: string | undefined): boolean {
  const raw = (value ?? "").trim();
  if (raw === "") return false;
  return !isWithinEntryLimit(Number(raw));
}

export function EntryScreen({
  teachers,
  classCodes,
  initialTeacherId,
}: {
  teachers: Teacher[];
  classCodes: string[];
  initialTeacherId: number | null;
}) {
  const [teacherId, setTeacherId] = useState<number | null>(initialTeacherId);
  const [classCode, setClassCode] = useState("");
  const [roster, setRoster] = useState<Student[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [points, setPoints] = useState<Record<number, string>>({});
  const [mode, setMode] = useState<"class" | "house">("class");
  const [flash, setFlash] = useState<Flash>(null);
  const [recent, setRecent] = useState<BatchSummary[]>([]);
  const [pending, startTransition] = useTransition();

  const teacherName = teachers.find((t) => t.id === teacherId)?.name ?? "";

  // Bumped after every submit or undo to re-pull the teacher's recent list.
  const [recentNonce, setRecentNonce] = useState(0);
  const refreshRecent = useCallback(() => setRecentNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    // A missing teacher id resolves to an empty list on the server, which keeps
    // this effect free of any synchronous state update.
    recentForTeacher(teacherId ?? 0)
      .then((rows) => {
        if (!cancelled) setRecent(rows);
      })
      .catch(() => {
        if (!cancelled) setRecent([]);
      });
    return () => {
      cancelled = true;
    };
  }, [teacherId, recentNonce]);

  function chooseTeacher(id: number | null) {
    setTeacherId(id);
    if (id) rememberTeacher(id).catch(() => {});
  }

  function chooseClass(code: string) {
    setClassCode(code);
    setPoints({});
    setFlash(null);
    if (!code) return setRoster([]);
    setLoadingRoster(true);
    loadRoster(code)
      .then(setRoster)
      .catch(() => setFlash({ message: "Could not load that class.", tone: "error" }))
      .finally(() => setLoadingRoster(false));
  }

  function bump(studentId: number, delta: number) {
    setPoints((prev) => {
      const current = Number(prev[studentId] ?? 0) || 0;
      const next = current + delta;
      return { ...prev, [studentId]: next === 0 ? "" : String(next) };
    });
  }

  const entered = roster
    .map((s) => ({ studentId: s.id, points: Number(points[s.id] ?? "") }))
    .filter((e) => Number.isFinite(e.points) && e.points !== 0);
  const enteredTotal = entered.reduce((sum, e) => sum + e.points, 0);
  const blockedCount = roster.filter((s) => overLimit(points[s.id])).length;

  function submitClass() {
    if (!teacherId || entered.length === 0 || blockedCount > 0) return;
    startTransition(async () => {
      const result = await submitClassPoints(teacherId, entered);
      if (result.ok) {
        setPoints({});
        setFlash({ message: result.message, tone: "ok", batchId: result.batchId });
      } else {
        setFlash({ message: result.message, tone: "error" });
      }
      refreshRecent();
    });
  }

  function undo(batchId: string) {
    startTransition(async () => {
      const result = await undoBatch(batchId, teacherName || "teacher");
      setFlash({ message: result.message, tone: result.ok ? "ok" : "error" });
      refreshRecent();
    });
  }

  const readyToEnter = teacherId !== null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-40 pt-6 sm:px-6">
      <Header />

      {/* Step 1 — who are you. Remembered, so usually already filled in. */}
      <section className="mt-6 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
        <label htmlFor="teacher" className="block text-sm font-semibold text-ink">
          Your name
        </label>
        <select
          id="teacher"
          value={teacherId ?? ""}
          onChange={(e) => chooseTeacher(e.target.value ? Number(e.target.value) : null)}
          className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none focus:border-sharks focus:ring-2 focus:ring-sharks/25"
        >
          <option value="">Select your name…</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {teachers.length === 0 && (
          <p className="mt-2 text-sm text-ink-soft">
            No teachers set up yet — add them in Admin.
          </p>
        )}
      </section>

      {readyToEnter && (
        <div className="mt-4 flex gap-2 rounded-xl bg-line/60 p-1">
          <ModeTab active={mode === "class"} onClick={() => setMode("class")}>
            Class points
          </ModeTab>
          <ModeTab active={mode === "house"} onClick={() => setMode("house")}>
            Whole house
          </ModeTab>
        </div>
      )}

      {readyToEnter && mode === "class" && (
        <ClassPanel
          classCodes={classCodes}
          classCode={classCode}
          chooseClass={chooseClass}
          roster={roster}
          loading={loadingRoster}
          points={points}
          setPoints={setPoints}
          bump={bump}
        />
      )}

      {readyToEnter && mode === "house" && (
        <HousePanel
          teacherId={teacherId}
          onDone={(f) => {
            setFlash(f);
            refreshRecent();
          }}
        />
      )}

      {!readyToEnter && (
        <p className="mt-6 text-center text-sm text-ink-soft">
          Choose your name to start awarding points.
        </p>
      )}

      {recent.length > 0 && <RecentList recent={recent} onUndo={undo} busy={pending} />}

      {flash && (
        <FlashBar flash={flash} onUndo={undo} onDismiss={() => setFlash(null)} busy={pending} />
      )}

      {mode === "class" && entered.length > 0 && (
        <SubmitBar
          count={entered.length}
          total={enteredTotal}
          blocked={blockedCount}
          busy={pending}
          onClear={() => setPoints({})}
          onSubmit={submitClass}
        />
      )}
    </div>
  );
}

function Header() {
  return (
    <header className="flex items-center justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">House Points</h1>
        <p className="text-sm text-ink-soft">Be your BEST</p>
      </div>
      <nav className="flex items-center gap-1 text-sm">
        <a
          href="/display"
          className="rounded-lg px-3 py-2 font-medium text-ink-soft hover:bg-line/70 hover:text-ink"
        >
          Leaderboard
        </a>
        <a
          href="/admin"
          className="rounded-lg px-3 py-2 font-medium text-ink-soft hover:bg-line/70 hover:text-ink"
        >
          Admin
        </a>
      </nav>
    </header>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
        active ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function ClassPanel({
  classCodes,
  classCode,
  chooseClass,
  roster,
  loading,
  points,
  setPoints,
  bump,
}: {
  classCodes: string[];
  classCode: string;
  chooseClass: (code: string) => void;
  roster: Student[];
  loading: boolean;
  points: Record<number, string>;
  setPoints: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  bump: (studentId: number, delta: number) => void;
}) {
  return (
    <>
      <section className="mt-4 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
        <label htmlFor="class" className="block text-sm font-semibold text-ink">
          Class
        </label>
        <select
          id="class"
          value={classCode}
          onChange={(e) => chooseClass(e.target.value)}
          className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none focus:border-sharks focus:ring-2 focus:ring-sharks/25"
        >
          <option value="">Select a class…</option>
          {classCodes.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </section>

      {loading && <p className="mt-6 text-center text-sm text-ink-soft">Loading class…</p>}

      {!loading && classCode && roster.length === 0 && (
        <p className="mt-6 text-center text-sm text-ink-soft">
          No students in {classCode}.
        </p>
      )}

      {roster.length > 0 && (
        <ul className="mt-4 space-y-2">
          {roster.map((student) => (
            <li
              key={student.id}
              className="rounded-2xl border border-line bg-surface p-3 shadow-sm"
              style={{ borderLeftColor: HOUSE_THEME[student.house].base, borderLeftWidth: 5 }}
            >
              {/* On a phone the name takes its own row: truncating it beside the
                  buttons made students with similar names indistinguishable. */}
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1">
                  <p className="min-w-0 flex-1 font-semibold text-ink">{student.name}</p>
                  <HouseBadge house={student.house} size="sm" />
                </div>

                <div className="flex w-full items-center justify-end gap-1.5 sm:w-auto">
                  {QUICK_STEPS.map((step) => (
                    <button
                      key={step}
                      type="button"
                      onClick={() => bump(student.id, step)}
                      className="h-11 w-11 rounded-xl border border-line bg-canvas text-sm font-bold text-ink transition hover:border-sharks hover:bg-sharks/10 active:scale-95"
                      aria-label={`Add ${step} to ${student.name}`}
                    >
                      +{step}
                    </button>
                  ))}
                  <PointsInput
                    student={student}
                    value={points[student.id] ?? ""}
                    onChange={(value) =>
                      setPoints((prev) => ({ ...prev, [student.id]: value }))
                    }
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Turns pink past the limit, so it is obvious while typing which entry is blocking. */
function PointsInput({
  student,
  value,
  onChange,
}: {
  student: Student;
  value: string;
  onChange: (value: string) => void;
}) {
  const flagged = overLimit(value);
  return (
    <input
      type="number"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="0"
      aria-label={`Points for ${student.name}`}
      aria-describedby={flagged ? "points-guideline" : undefined}
      title={
        flagged
          ? `Maximum ${MAX_POINTS_PER_ENTRY} points per student in one go — award again to give more.`
          : undefined
      }
      className={`h-11 w-20 rounded-xl border text-center text-base font-bold outline-none focus:ring-2 ${
        flagged
          ? "border-flag bg-flag-soft text-flag-ink focus:border-flag focus:ring-flag/30"
          : "border-line bg-surface text-ink focus:border-sharks focus:ring-sharks/25"
      }`}
    />
  );
}

function HousePanel({
  teacherId,
  onDone,
}: {
  teacherId: number;
  onDone: (flash: Flash) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busyHouse, setBusyHouse] = useState<House | null>(null);

  function award(house: House) {
    const amount = Number(values[house] ?? "");
    if (!Number.isFinite(amount) || amount === 0) {
      onDone({ message: `Enter points for ${house} first.`, tone: "error" });
      return;
    }
    setBusyHouse(house);
    submitWholeHousePoints(teacherId, house, amount)
      .then((result) => {
        if (result.ok) setValues((prev) => ({ ...prev, [house]: "" }));
        onDone({
          message: result.message,
          tone: result.ok ? "ok" : "error",
          batchId: result.ok ? result.batchId : undefined,
        });
      })
      .finally(() => setBusyHouse(null));
  }

  return (
    <section className="mt-4">
      <p className="mb-3 text-sm text-ink-soft">
        Points awarded here go to the house total only — they are not shared out
        between students.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {HOUSES.map((house) => {
          const theme = HOUSE_THEME[house];
          return (
            <div
              key={house}
              className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm"
            >
              <div
                className="px-4 py-3 text-base font-bold"
                style={{ backgroundColor: theme.base, color: theme.ink }}
              >
                {house}
              </div>
              <div className="flex items-center gap-2 p-3">
                <input
                  type="number"
                  inputMode="numeric"
                  value={values[house] ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [house]: e.target.value }))
                  }
                  placeholder="0"
                  aria-label={`Points for ${house}`}
                  className="h-12 w-24 rounded-xl border border-line bg-surface text-center text-lg font-bold text-ink outline-none focus:ring-2"
                  style={{ outlineColor: theme.base }}
                />
                <button
                  type="button"
                  onClick={() => award(house)}
                  disabled={busyHouse === house}
                  className="h-12 flex-1 rounded-xl text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-60"
                  style={{ backgroundColor: theme.dark }}
                >
                  {busyHouse === house ? "Awarding…" : `Award to ${house}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RecentList({
  recent,
  onUndo,
  busy,
}: {
  recent: BatchSummary[];
  onUndo: (batchId: string) => void;
  busy: boolean;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-ink-soft">Your recent submissions</h2>
      <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {recent.map((batch) => (
          <li key={batch.batchId} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${batch.voided ? "text-ink-soft line-through" : "text-ink"}`}>
                <span className="font-semibold">{batch.total} pts</span>{" "}
                {batch.kind === "house"
                  ? `to ${batch.house}`
                  : `to ${batch.count} in ${batch.classCode ?? "class"}`}
              </p>
              <p className="text-xs text-ink-soft">{formatWhen(batch.createdAt)}</p>
            </div>
            {batch.voided ? (
              <span className="text-xs font-medium text-ink-soft">Undone</span>
            ) : (
              <button
                type="button"
                onClick={() => onUndo(batch.batchId)}
                disabled={busy}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-tigers hover:text-tigers disabled:opacity-50"
              >
                Undo
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function FlashBar({
  flash,
  onUndo,
  onDismiss,
  busy,
}: {
  flash: NonNullable<Flash>;
  onUndo: (batchId: string) => void;
  onDismiss: () => void;
  busy: boolean;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(onDismiss, 6000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [flash, onDismiss]);

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-24 z-20 mx-auto flex w-[min(38rem,calc(100%-2rem))] items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-lg"
      style={{ backgroundColor: flash.tone === "ok" ? "#14181f" : "#951c1c" }}
    >
      <span className="flex-1">{flash.message}</span>
      {flash.batchId && (
        <button
          type="button"
          onClick={() => onUndo(flash.batchId!)}
          disabled={busy}
          className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wide hover:bg-white/25 disabled:opacity-50"
        >
          Undo
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-white/60 hover:text-white"
      >
        ✕
      </button>
    </div>
  );
}

function SubmitBar({
  count,
  total,
  blocked,
  busy,
  onClear,
  onSubmit,
}: {
  count: number;
  total: number;
  blocked: number;
  busy: boolean;
  onClear: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex-1">
          <p className="text-sm font-bold text-ink">
            {total} {Math.abs(total) === 1 ? "point" : "points"}
          </p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
            <span>
              {count} {count === 1 ? "student" : "students"}
            </span>
            {blocked > 0 && (
              <span
                id="points-guideline"
                className="rounded-full bg-flag-soft px-2 py-0.5 font-semibold text-flag-ink"
              >
                {blocked} over {MAX_POINTS_PER_ENTRY} — max {MAX_POINTS_PER_ENTRY} each
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={busy}
          className="rounded-xl border border-line px-4 py-3 text-sm font-semibold text-ink-soft hover:text-ink disabled:opacity-50"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy || blocked > 0}
          title={
            blocked > 0
              ? `Reduce the pink entries to ${MAX_POINTS_PER_ENTRY} or less before submitting.`
              : undefined
          }
          className="rounded-xl bg-ink px-6 py-3 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? "Submitting…" : "Submit"}
        </button>
      </div>
    </div>
  );
}

function formatWhen(iso: string): string {
  // SQLite datetime('now') is UTC without a zone marker.
  const date = new Date(iso.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
