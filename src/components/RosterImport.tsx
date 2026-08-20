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

export function RosterImport({ currentYear }: { currentYear: string }) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirm, setConfirm] = useState("");
  const [yearName, setYearName] = useState("");
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function check(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      setPreview(await previewRosterCsv(formData));
    });
  }

  function replace() {
    if (!preview?.csv) return;
    startTransition(async () => {
      const r = await commitRosterReplace(preview.csv!);
      setResult({ text: r.message, ok: r.ok });
      if (r.ok) reset();
    });
  }

  function newYear() {
    if (!preview?.csv || confirm.trim().toUpperCase() !== CONFIRM_PHRASE) return;
    startTransition(async () => {
      const r = await commitStartNewYear(preview.csv!, yearName);
      setResult({ text: r.message, ok: r.ok });
      if (r.ok) reset();
    });
  }

  function reset() {
    setPreview(null);
    setConfirm("");
    setYearName("");
    formRef.current?.reset();
  }

  const balanced = preview ? houseSpread(preview.houseCounts) : 0;

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <h2 className="text-base font-bold text-ink">Import roster from CSV</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Needs three columns: <code className="font-mono text-xs">name</code>,{" "}
        <code className="font-mono text-xs">class</code>,{" "}
        <code className="font-mono text-xs">house</code>. Nothing is changed until
        you confirm.
      </p>

      <form ref={formRef} action={check} className="mt-4 flex flex-wrap items-center gap-2">
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
        <div className="mt-5 rounded-xl border border-line bg-canvas p-4">
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
              {balanced > 15 && (
                <p className="mt-2 text-xs font-medium text-eagles-dark">
                  Houses differ by {balanced} students — worth checking before you
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
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-line bg-surface p-4">
                <p className="text-sm font-bold text-ink">
                  Correct this year&rsquo;s roster
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  Replaces the student list for {currentYear}. Points already
                  awarded stay on the record. Use this if the roster was uploaded
                  wrong.
                </p>
                <button
                  type="button"
                  onClick={replace}
                  disabled={pending}
                  className="mt-3 rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-ink disabled:opacity-60"
                >
                  Replace roster
                </button>
              </div>

              <div className="rounded-xl border-2 border-tigers/30 bg-tigers/5 p-4">
                <p className="text-sm font-bold text-tigers-dark">
                  Start a new school year
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  Every house and student total goes back to zero and this roster
                  begins the new year. {currentYear} is closed and kept — you can
                  still export its records.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    value={yearName}
                    onChange={(e) => setYearName(e.target.value)}
                    placeholder="New year name (e.g. 2027-28)"
                    className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-tigers"
                  />
                  <input
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder={`Type ${CONFIRM_PHRASE}`}
                    className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-tigers"
                  />
                </div>
                <button
                  type="button"
                  onClick={newYear}
                  disabled={pending || confirm.trim().toUpperCase() !== CONFIRM_PHRASE}
                  className="mt-3 rounded-xl bg-tigers-dark px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                >
                  Reset everything and start new year
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Gap between the largest and smallest house, used as a balance warning. */
function houseSpread(counts: Record<string, number>): number {
  const values = HOUSES.map((h) => counts[h] ?? 0);
  return Math.max(...values) - Math.min(...values);
}
