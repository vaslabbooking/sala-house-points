"use client";

import { useRef, useState, useTransition } from "react";
import {
  commitStartNewYear,
  previewRosterCsv,
  type ImportPreview,
} from "@/app/admin/actions";
import { HOUSES, HOUSE_THEME } from "@/lib/houses";

const CONFIRM_PHRASE = "START NEW YEAR";

/**
 * The only bulk roster operation. A mid-year "replace the roster" option used
 * to sit alongside it, but re-importing gave every student a fresh record and
 * hid the old one, so a child ended up on the leaderboard twice — once with
 * the points earned before the import and once with those earned after.
 * Individual students are added, moved and removed one at a time instead.
 *
 * Kept collapsed: this screen is used constantly for single students, and a
 * once-a-year action that zeroes every total should take a deliberate click to
 * even open.
 */
export function StartNewYear({ currentYear }: { currentYear: string }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirm, setConfirm] = useState("");
  const [yearName, setYearName] = useState("");
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function check(formData: FormData) {
    setResult(null);
    startTransition(async () => setPreview(await previewRosterCsv(formData)));
  }

  function apply() {
    if (!preview?.csv) return;
    startTransition(async () => {
      const outcome = await commitStartNewYear(preview.csv!, yearName);
      setResult({ text: outcome.message, ok: outcome.ok });
      if (outcome.ok) {
        setPreview(null);
        setConfirm("");
        setYearName("");
        formRef.current?.reset();
        setOpen(false);
      }
    });
  }

  const confirmed = confirm.trim().toUpperCase() === CONFIRM_PHRASE;
  const spread = preview ? houseSpread(preview.houseCounts) : 0;

  if (!open) {
    return (
      <section className="mt-5 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-ink">Start a new school year</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Loads next year&rsquo;s roster and sets every total back to zero.
              {" "}
              {currentYear} is closed and archived, not deleted.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-ink-soft hover:border-tigers hover:text-tigers"
          >
            Open
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-5 rounded-2xl border-2 border-tigers/40 bg-tigers/5 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-tigers-dark">
            Start a new school year
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Every house and student total goes back to zero and this roster
            begins the new year. {currentYear} is closed and kept — its records
            stay exportable.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setPreview(null);
            setConfirm("");
          }}
          className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-soft hover:text-ink"
        >
          Cancel
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-surface p-4">
        <p className="text-sm font-semibold text-ink">Roster for the new year</p>
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
        <div className="mt-4 rounded-xl border border-line bg-surface p-4">
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
                This will set every total back to zero and begin a new year with
                these {preview.students} students.
              </p>
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
              <button
                type="button"
                onClick={apply}
                disabled={pending || !confirmed}
                className="mt-3 rounded-xl bg-tigers-dark px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
              >
                Reset everything and start new year
              </button>
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
