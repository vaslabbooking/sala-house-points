import {
  getHouseTotals,
  getTopClassesByHouse,
  getTopStudentsByHouse,
} from "@/lib/queries";
import { SETTING, getCurrentYear, getSetting } from "@/lib/settings";
import { requireAccess } from "@/lib/guard";
import { AutoRefresh } from "@/components/AutoRefresh";
import { HouseRace } from "@/components/HouseRace";

export const dynamic = "force-dynamic";

export const metadata = { title: "House Points — Leaderboard" };

export default async function DisplayPage() {
  // Student names appear here, so the leaderboard sits behind the staff code
  // unless it has been deliberately opened up (e.g. for a reception screen).
  if ((await getSetting(SETTING.publicDisplay)) !== "1") {
    await requireAccess("/display");
  }

  const [totals, topStudents, topClasses, year, animateSetting] = await Promise.all([
    getHouseTotals(),
    getTopStudentsByHouse(5),
    getTopClassesByHouse(3),
    getCurrentYear(),
    getSetting(SETTING.animateDisplay),
  ]);

  // On unless switched off, so a fresh deployment gets the reveal by default.
  const animate = animateSetting !== "0";
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
        <HouseRace
          totals={totals}
          topStudents={topStudents}
          topClasses={topClasses}
          animate={animate}
        />
      )}
    </main>
  );
}
