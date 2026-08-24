"use client";

import { useRef, useState, useTransition } from "react";
import {
  commitRosterReplace,
  commitStartNewYear,
  previewRosterCsv,
  type ImportPreview,
} from "@/app/admin/actions";
import { HOUSES, HOUSE_THEME } from "@/lib/houses";

const CONFIRM_PHRASE = "START NEW YEAR";

type Mode = "update" | "newYear";

/**
 * The intent is chosen before a file is picked. An earlier version asked for
 * the CSV first and only then offered "replace the roster" or "start a new
 * year" side by side, which meant the consequences were discovered after the
 * upload — and put a once-a-year action that zeroes every total next to the
 * routine one.
 */
export function RosterImport({ currentYear }: { currentYear: string }) {
  const [mode, setMode] = useState<Mode>("update");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirm, setConfirm] = useState("");
  const [yearName, setYearName] = useState("");
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function chooseMode(next: Mode) {
    // Never carry a checked file across: it was checked for a different action.
    setMode(next);
    setPreview(null);
    setConfirm("");
    setResult(null);
    formRef.current?.reset();
  }

  function check(formData: FormData) {
    setResult(null);
    startTransition(async () => setPreview(await previewRosterCsv(formData)));
  }

  function apply() {
    if (!preview?.csv) return;
    startTransition(async () => {
      const outcome =
        mode === "update"
          ? await commitRosterReplace(preview.csv!)
          : await commitStartNewYear(preview.csv!, yearName);
      setResult({ text: outcome.message, ok: outcome.ok });
      if (outcome.ok) {
        setPreview(null);
        setConfirm("");
        setYearName("");
        formRef.current?.reset();
      }
    });
  }

  const newYear = mode === "newYear";
  const confirmed = !newYear || confirm.trim().toUpperCase() === CONFIRM_PHRASE;
  const spread = preview ? houseSpread(preview.houseCounts) : 0;

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <h2 className="text-base font-bold text-ink">Roster</h2>
      <p className="mt-1 text-sm text-ink-soft">
        What would you like to do?
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <ModeCard
          selected={mode === "update"}
          onClick={() => chooseMode("update")}
          title="Update this year's roster"
          detail={`Replaces the student list for ${currentYear}. Every point already awarded is kept.`}
        />
        <ModeCard
          selected={newYear}
          onClick={() => chooseMode("newYear")}
          title="Start a new school year"
          detail="Every house and student total goes back to zero. This year is closed and archived, not deleted."
          danger
        />
      </div>

      <div
        className={`mt-4 rounded-xl border p-4 ${
          newYear ? "border-tigers/40 bg-tigers/5" : "border-line bg-canvas"
        }`}
      >
        <p className="text-sm font-semibold text-ink">
          {newYear
            ? "Roster for the new year"
            : `New student list for ${currentYear}`}
        </p>
        <p className="mt-1 text-xs text-ink-soft">
          Three columns: <code className="font-mono">name</code>,{" "}
          <code className="font-mono">class</code>,{" "}
          <code className="font-mono">house</code>. The file is checked first and
          nothing changes until you confirm.
        </p>

        <form ref={formRef} action={check} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="min-w-0 flex-1 text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-line file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink hover:file:bg-line/70"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {pending ? "Checking…" : "Check file"}
          </button>
        </form>
      </div>

      {result && (
        <p
          className={`mt-4 rounded-lg px-3 py-2 text-sm font-medium ${
            result.ok ? "bg-bears/10 text-bears-dark" : "bg-tigers/10 text-tigers-dark"
          }`}
        >
          {result.text}
        </p>
      )}

      {preview && (
        <div className="mt-4 rounded-xl border border-line bg-canvas p-4">
          <p className="text-sm font-semibold text-ink">{preview.message}</p>

          {preview.students > 0 && (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {HOUSES.map((house) => (
                  <div
                    key={house}
                    className="rounded-lg px-3 py-2"
                    style={{
                      backgroundColor: HOUSE_THEME[house].base,
                      color: HOUSE_THEME[house].ink,
                    }}
                  >
                    <p className="text-xs font-bold uppercase">{house}</p>
                    <p className="text-lg font-black tabular-nums">
                      {preview.houseCounts[house] ?? 0}
                    </p>
                  </div>
                ))}
              </div>
              {spread > 15 && (
                <p className="mt-2 text-xs font-medium text-eagles-dark">
                  Houses differ by {spread} students — worth checking before you
                  import, since house totals are compared directly.
                </p>
              )}
            </>
          )}

          {preview.errors.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-tigers-dark">
                {preview.errors.length} row
                {preview.errors.length === 1 ? "" : "s"} could not be read and will
                be skipped:
              </p>
              <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-xs text-ink-soft">
                {preview.errors.slice(0, 50).map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {preview.students > 0 && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-sm font-semibold text-ink">
                {newYear
                  ? `This will set every total back to zero and begin a new year with these ${preview.students} students.`
                  : `This will replace the student list for ${currentYear} with these ${preview.students} students, keeping all points awarded so far.`}
              </p>

              {newYear && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    value={yearName}
                    onChange={(e) => setYearName(e.target.value)}
                    placeholder="Name for the new year (e.g. 2027-28)"
                    className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-tigers"
                  />
                  <input
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder={`Type ${CONFIRM_PHRASE}`}
                    className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-tigers"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={apply}
                disabled={pending || !confirmed}
                className={`mt-3 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40 ${
                  newYear ? "bg-tigers-dark" : "bg-ink"
                }`}
              >
                {newYear ? "Reset everything and start new year" : "Replace roster"}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ModeCard({
  selected,
  onClick,
  title,
  detail,
  danger,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  detail: string;
  danger?: boolean;
}) {
  const accent = danger ? "border-tigers bg-tigers/5" : "border-sharks bg-sharks/5";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-xl border-2 p-3 text-left transition ${
        selected ? accent : "border-line bg-surface hover:border-ink-soft/40"
      }`}
    >
      <span
        className={`block text-sm font-bold ${
          danger && selected ? "text-tigers-dark" : "text-ink"
        }`}
      >
        {title}
      </span>
      <span className="mt-1 block text-xs text-ink-soft">{detail}</span>
    </button>
  );
}

/** Gap between the largest and smallest house, used as a balance warning. */
function houseSpread(counts: Record<string, number>): number {
  const values = HOUSES.map((h) => counts[h] ?? 0);
  return Math.max(...values) - Math.min(...values);
}
