import type { SchoolYearSummary } from "@/lib/admin";

/**
 * Every school year the app has run, with its records still reachable.
 * Starting a new year closes the previous one rather than deleting it — this
 * is where those closed years are downloaded.
 */
export function YearArchive({ years }: { years: SchoolYearSummary[] }) {
  return (
    <section className="mt-5 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <h2 className="text-base font-bold text-ink">Records and archive</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Every year is kept when a new one starts. Download the full award log,
        or a one-line-per-student summary of where a year finished.
      </p>

      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line">
        {years.map((year) => (
          <li key={year.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
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

            <div className="flex gap-2">
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
            </div>
          </li>
        ))}
      </ul>

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
