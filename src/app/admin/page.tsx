import { requireAdmin } from "@/lib/guard";
import { getOverview, getTeacherStats } from "@/lib/admin";
import { getHouseTotals } from "@/lib/queries";
import { HOUSE_THEME } from "@/lib/houses";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await requireAdmin();
  const [overview, houses, teachers] = await Promise.all([
    getOverview(),
    getHouseTotals(),
    getTeacherStats(),
  ]);

  const activeTeachers = teachers.filter((t) => t.active);
  const contributing = activeTeachers.filter((t) => t.points > 0).length;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        Overview <span className="font-normal text-ink-soft">· {overview.yearName}</span>
      </h1>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Students" value={overview.students} />
        <Stat label="Classes" value={overview.classes} />
        <Stat label="Teachers" value={overview.teachers} />
        <Stat label="Awards given" value={overview.awards} />
        <Stat label="Points total" value={overview.points} />
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-ink-soft">House totals</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {houses.map((h) => (
            <div
              key={h.house}
              className="rounded-2xl px-4 py-3"
              style={{ backgroundColor: HOUSE_THEME[h.house].base, color: HOUSE_THEME[h.house].ink }}
            >
              <p className="text-sm font-bold uppercase tracking-wide">{h.house}</p>
              <p className="text-2xl font-black tabular-nums">
                {h.points.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink-soft">
            Teacher activity — {contributing} of {activeTeachers.length} have awarded points
          </h2>
          <a href="/admin/teachers" className="text-sm font-medium text-sharks hover:underline">
            Manage teachers
          </a>
        </div>
        <div className="mt-2 overflow-hidden rounded-2xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-4 py-2 font-semibold">Teacher</th>
                <th className="px-4 py-2 text-right font-semibold">Submissions</th>
                <th className="px-4 py-2 text-right font-semibold">Awards</th>
                <th className="px-4 py-2 text-right font-semibold">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {activeTeachers.map((t) => (
                <tr key={t.id} className={t.points === 0 ? "text-ink-soft" : "text-ink"}>
                  <td className="px-4 py-2 font-medium">{t.name}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{t.submissions}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{t.awardsGiven}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">
                    {t.points.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3">
      <p className="text-2xl font-black tabular-nums text-ink">
        {value.toLocaleString()}
      </p>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</p>
    </div>
  );
}
