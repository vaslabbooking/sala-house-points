"use client";

import { useState, useTransition } from "react";
import { removeSchoolYear } from "@/app/admin/actions";
import type { SchoolYearSummary } from "@/lib/admin";

/**
 * Every school year the app has run. Starting a new year closes the previous
 * one rather than deleting it, so this is where closed years are downloaded —
 * and, when a year is no longer wanted, removed.
 */
export function YearArchive({ years }: { years: SchoolYearSummary[] }) {
  const [confirming, setConfirming] = useState<number | null>(null);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(yearId: number) {
    startTransition(async () => {
      const result = await removeSchoolYear(yearId);
      setNote({ text: result.message, ok: result.ok });
      setConfirming(null);
    });
  }

  return (
    <section className="mt-5 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <h2 className="text-base font-bold text-ink">Records and archive</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Every year is kept when a new one starts. Download the full award log,
        or a one-line-per-student summary of where a year finished.
      </p>

      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line">
        {years.map((year) => (
          <li key={year.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">
                  {year.name}
                  {year.isCurrent && (
                    <span className="ml-2 rounded-full bg-bears/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-bears-dark">
                      Current
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {year.students.toLocaleString()} students ·{" "}
                  {year.points.toLocaleString()} points ·{" "}
                  {year.awards.toLocaleString()} awards
                  {year.endedAt && ` · closed ${formatDate(year.endedAt)}`}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <a
                  href={`/admin/export?year=${year.id}&format=totals`}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-sharks hover:text-sharks"
                >
                  Student totals
                </a>
                <a
                  href={`/admin/export?year=${year.id}&format=awards`}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-sharks hover:text-sharks"
                >
                  Full award log
                </a>
                {/* The current year is never deletable — closing it is what
                    archives it in the first place. */}
                {!year.isCurrent && confirming !== year.id && (
                  <button
                    type="button"
                    onClick={() => setConfirming(year.id)}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-tigers hover:text-tigers"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>

            {confirming === year.id && (
              <div className="mt-3 rounded-lg border border-tigers/40 bg-tigers/5 p-3">
                <p className="text-xs font-semibold text-tigers-dark">
                  Permanently delete {year.name}? This removes{" "}
                  {year.students.toLocaleString()} student records and{" "}
                  {year.awards.toLocaleString()} awards. Download it first if you
                  might want it — this cannot be undone.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => remove(year.id)}
                    disabled={pending}
                    className="rounded-lg bg-tigers-dark px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {pending ? "Deleting…" : "Yes, delete it"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {note && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${
            note.ok ? "bg-bears/10 text-bears-dark" : "bg-tigers/10 text-tigers-dark"
          }`}
        >
          {note.text}
        </p>
      )}

      {years.length === 1 && (
        <p className="mt-3 text-xs text-ink-soft">
          Only this year so far. Archived years will appear here once a new
          school year is started.
        </p>
      )}
    </section>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso.replace(" ", "T") + "Z");
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}
