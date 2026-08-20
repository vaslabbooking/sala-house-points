import { HOUSE_THEME, type House } from "@/lib/houses";
import {
  getHouseTotals,
  getTopClassesByHouse,
  getTopStudentsByHouse,
  type ClassTotal,
  type StudentTotal,
} from "@/lib/queries";
import { SETTING, getCurrentYear, getSetting } from "@/lib/settings";
import { requireAccess } from "@/lib/guard";
import { AutoRefresh } from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

export const metadata = { title: "House Points — Leaderboard" };

export default async function DisplayPage() {
  // Student names appear here, so the leaderboard sits behind the staff code
  // unless it has been deliberately opened up (e.g. for a reception screen).
  if ((await getSetting(SETTING.publicDisplay)) !== "1") {
    await requireAccess("/display");
  }

  const [totals, topStudents, topClasses, year] = await Promise.all([
    getHouseTotals(),
    getTopStudentsByHouse(5),
    getTopClassesByHouse(3),
    getCurrentYear(),
  ]);

  const max = Math.max(...totals.map((t) => t.points), 1);
  const grandTotal = totals.reduce((sum, t) => sum + t.points, 0);

  return (
    <main className="flex-1 bg-[#0d1117] px-4 py-6 text-white sm:px-8 sm:py-8">
      <AutoRefresh seconds={20} />

      <header className="mx-auto flex max-w-[1600px] flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
            House Points
          </h1>
          <p className="mt-1 text-sm font-semibold uppercase tracking-[0.2em] text-white/40 sm:text-base">
            Be your BEST · {year.name}
          </p>
        </div>
        <p className="text-right text-sm text-white/40 sm:text-base">
          <span className="block text-2xl font-bold text-white sm:text-3xl">
            {grandTotal.toLocaleString()}
          </span>
          points awarded
        </p>
      </header>

      {grandTotal === 0 ? (
        <p className="mx-auto mt-24 max-w-lg text-center text-lg text-white/50">
          No points yet this year. As soon as staff start awarding, the houses
          will appear here.
        </p>
      ) : (
        <>
          <section className="mx-auto mt-8 grid max-w-[1600px] grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {totals.map((total, index) => (
              <HouseColumn
                key={total.house}
                house={total.house}
                points={total.points}
                rank={index + 1}
                share={total.points / max}
              />
            ))}
          </section>

          <section className="mx-auto mt-5 grid max-w-[1600px] gap-3 sm:gap-5 lg:grid-cols-4">
            {totals.map((total) => (
              <HouseDetail
                key={total.house}
                house={total.house}
                students={topStudents[total.house] ?? []}
                classes={topClasses[total.house] ?? []}
              />
            ))}
          </section>
        </>
      )}
    </main>
  );
}

/**
 * Fill height is proportional to the leading house, so the gap between houses
 * is readable from the back of a hall without misrepresenting the numbers.
 */
function HouseColumn({
  house,
  points,
  rank,
  share,
}: {
  house: House;
  points: number;
  rank: number;
  share: number;
}) {
  const theme = HOUSE_THEME[house];
  const fill = Math.max(share * 100, 6);

  return (
    <div className="relative flex h-56 flex-col justify-end overflow-hidden rounded-3xl bg-white/5 ring-1 ring-white/10 sm:h-80">
      <div
        className="absolute inset-x-0 bottom-0 transition-[height] duration-700 ease-out"
        style={{
          height: `${fill}%`,
          background: `linear-gradient(to top, ${theme.dark}, ${theme.base})`,
        }}
      />
      <div className="relative flex h-full flex-col justify-between p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <span
            className="grid size-8 place-items-center rounded-full text-sm font-black sm:size-10 sm:text-base"
            style={{ backgroundColor: rank === 1 ? "#ffffff" : "rgba(255,255,255,0.18)", color: rank === 1 ? theme.dark : "#ffffff" }}
          >
            {rank}
          </span>
          {rank === 1 && (
            <span className="text-2xl sm:text-3xl" aria-label="Leading house">
              👑
            </span>
          )}
        </div>
        <div>
          <p className="text-2xl font-black leading-none tracking-tight sm:text-4xl">
            {house}
          </p>
          <p className="mt-1 text-3xl font-black tabular-nums sm:mt-2 sm:text-6xl">
            {points.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

function HouseDetail({
  house,
  students,
  classes,
}: {
  house: House;
  students: StudentTotal[];
  classes: ClassTotal[];
}) {
  const theme = HOUSE_THEME[house];
  return (
    <div className="overflow-hidden rounded-3xl bg-white/5 ring-1 ring-white/10">
      <div
        className="px-4 py-2 text-sm font-black uppercase tracking-widest sm:text-base"
        style={{ backgroundColor: theme.base, color: theme.ink }}
      >
        {house}
      </div>

      <div className="p-4">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/40">
          Top students
        </h3>
        {students.length === 0 ? (
          <p className="mt-2 text-sm text-white/30">No points yet</p>
        ) : (
          <ol className="mt-2 space-y-1.5">
            {students.map((student, i) => (
              <li key={student.id} className="flex items-baseline gap-2 text-sm">
                <span className="w-4 shrink-0 font-bold text-white/30 tabular-nums">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium" title={student.name}>
                  {student.name}
                </span>
                <span className="shrink-0 font-bold tabular-nums" style={{ color: theme.base }}>
                  {student.points.toLocaleString()}
                </span>
              </li>
            ))}
          </ol>
        )}

        <h3 className="mt-5 text-[11px] font-bold uppercase tracking-widest text-white/40">
          Top classes
        </h3>
        {classes.length === 0 ? (
          <p className="mt-2 text-sm text-white/30">No points yet</p>
        ) : (
          <ol className="mt-2 space-y-1.5">
            {classes.map((entry, i) => (
              <li key={entry.classCode} className="flex items-baseline gap-2 text-sm">
                <span className="w-4 shrink-0 font-bold text-white/30 tabular-nums">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {entry.classCode}
                </span>
                <span className="shrink-0 font-bold tabular-nums" style={{ color: theme.base }}>
                  {entry.points.toLocaleString()}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
