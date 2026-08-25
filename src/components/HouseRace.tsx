"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { HOUSES, HOUSE_THEME, type House } from "@/lib/houses";
import type { ClassTotal, HouseTotal, StudentTotal } from "@/lib/queries";
import { Confetti, lighten } from "./Confetti";
import { MascotBurst, useMascotArtwork } from "./MascotBurst";
import { mascotCandidates, soundCandidates } from "@/lib/mascots";

/*
 * The reveal, in beats:
 *   1. every bar empty at zero, in B.E.S.T order
 *   2. one house at a time fills while its number counts up
 *   3. once filled, that house slides into its rank among those revealed
 *   4. after the last house, the row reads leader → lowest, left to right
 */
const START_DELAY = 600;
const FILL_MS = 1300;
const PAUSE_MS = 350;
const STEP_MS = FILL_MS + PAUSE_MS;
const SLIDE_MS = 700;

type Phase = "pending" | "filling" | "settled";

export function HouseRace({
  totals,
  topStudents,
  topClasses,
  animate,
  mascot,
  sound,
}: {
  totals: HouseTotal[];
  topStudents: Record<House, StudentTotal[]>;
  topClasses: Record<House, ClassTotal[]>;
  animate: boolean;
  mascot: boolean;
  sound: boolean;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [runId, setRunId] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [ordered, setOrdered] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);

  // Fetched and decoded now, so the winner's artwork is ready when it is needed.
  const artwork = useMascotArtwork();

  // With animation off — or the viewer asking for less motion — everything is
  // simply shown in its final state. Derived, so no state has to be unwound.
  const skip = !animate || reducedMotion;
  const shownCount = skip ? HOUSES.length : revealed;
  const orderedCount = skip ? HOUSES.length : ordered;

  const points = new Map(totals.map((t) => [t.house, t.points]));
  const max = Math.max(...totals.map((t) => t.points), 1);

  useEffect(() => {
    if (skip) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    HOUSES.forEach((_, i) => {
      // The bar starts filling…
      timers.push(setTimeout(() => setRevealed(i + 1), START_DELAY + i * STEP_MS));
      // …and only takes its place in the ranking once it has finished.
      timers.push(
        setTimeout(() => setOrdered(i + 1), START_DELAY + i * STEP_MS + FILL_MS),
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [skip, runId]);

  const replay = useCallback(() => {
    setRevealed(0);
    setOrdered(0);
    setStopped(false);
    setRunId((n) => n + 1);
  }, []);

  // R restarts the reveal — assembly rarely begins the moment the page loads.
  // Escape or S stops the celebration without disturbing the standings.
  useEffect(() => {
    if (skip) return;
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "r" || key === " ") {
        event.preventDefault();
        replay();
      } else if (key === "escape" || key === "s") {
        event.preventDefault();
        setStopped(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [skip, replay]);

  // Houses that have finished filling are ranked; the rest wait in B.E.S.T order.
  const ranked = HOUSES.slice(0, orderedCount).sort(
    (a, b) => (points.get(b) ?? 0) - (points.get(a) ?? 0) || a.localeCompare(b),
  );
  const displayOrder: House[] = [...ranked, ...HOUSES.slice(orderedCount)];

  const containerRef = useFlip(displayOrder.join(","));

  // The celebration begins once every house has taken its final position, and
  // runs in the leading house's colours until someone stops it.
  const revealComplete = !skip && ordered === HOUSES.length;
  const celebrating = revealComplete && !stopped;
  // getHouseTotals returns the houses already ranked, so the leader is first.
  // Taken from the prop rather than from displayOrder, which is built by
  // sorting a copy in place and so reads as mutable to the compiler.
  const winner = totals[0]?.house ?? HOUSES[0];
  const winnerTheme = HOUSE_THEME[winner];

  const handleSoundBlocked = useCallback(() => setSoundBlocked(true), []);

  // Playing on a click satisfies the browser's autoplay rules, so later
  // reveals in this session can start their own sound unprompted.
  const unlockSound = useCallback(() => {
    const audio = new Audio(soundCandidates(winner)[0]);
    audio.volume = 0.85;
    audio.play().finally(() => setSoundBlocked(false));
  }, [winner]);

  return (
    <>
      <section
        ref={containerRef}
        aria-label="House standings"
        className="mx-auto mt-8 grid max-w-[1600px] grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4"
      >
        {displayOrder.map((house, position) => {
          const revealIndex = HOUSES.indexOf(house);
          const phase: Phase = skip
            ? "settled"
            : revealIndex >= shownCount
              ? "pending"
              : revealIndex === shownCount - 1 && ordered < shownCount
                ? "filling"
                : "settled";

          return (
            <HouseColumn
              key={house}
              house={house}
              points={points.get(house) ?? 0}
              max={max}
              rank={position + 1}
              phase={phase}
              ranked={revealIndex < orderedCount}
              students={topStudents[house] ?? []}
              classes={topClasses[house] ?? []}
            />
          );
        })}
      </section>

      {/* Keyed on the run so a replay mounts a fresh burst and plays it again. */}
      {revealComplete && mascot && (
        <MascotBurst
          key={runId}
          house={winner}
          // Falls back to the first candidate if warming has not finished —
          // better a late-loading mascot than none at all.
          src={artwork[winner] ?? mascotCandidates(winner)[0]}
          sound={sound}
          onSoundBlocked={handleSoundBlocked}
        />
      )}

      <Confetti
        running={celebrating}
        colours={[
          winnerTheme.base,
          winnerTheme.dark,
          lighten(winnerTheme.base, 0.45),
        ]}
      />

      {!skip && (
        <div className="mx-auto mt-6 flex max-w-[1600px] justify-end gap-2">
          {soundBlocked && (
            <button
              type="button"
              onClick={unlockSound}
              className="z-50 rounded-full border border-white/25 px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-white/50 hover:text-white"
            >
              🔊 Enable sound
            </button>
          )}
          {celebrating && (
            <button
              type="button"
              onClick={() => setStopped(true)}
              className="z-50 rounded-full px-4 py-2 text-xs font-bold text-white shadow-lg transition hover:brightness-110"
              style={{ backgroundColor: winnerTheme.dark }}
            >
              Stop confetti <span className="opacity-60">· press S</span>
            </button>
          )}
          <button
            type="button"
            onClick={replay}
            className="z-50 rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/40 transition hover:border-white/40 hover:text-white/80"
          >
            Replay <span className="text-white/25">· press R</span>
          </button>
        </div>
      )}
    </>
  );
}

function HouseColumn({
  house,
  points,
  max,
  rank,
  phase,
  ranked,
  students,
  classes,
}: {
  house: House;
  points: number;
  max: number;
  rank: number;
  phase: Phase;
  ranked: boolean;
  students: StudentTotal[];
  classes: ClassTotal[];
}) {
  const theme = HOUSE_THEME[house];
  const shown = useCountUp(points, phase);
  // Bars are scaled against the eventual leader, so nothing rescales mid-race.
  const fill = phase === "pending" ? 0 : Math.max((points / max) * 100, 6);

  return (
    <div data-house={house} className="flex flex-col gap-3 sm:gap-5">
      <div className="relative flex h-56 flex-col justify-end overflow-hidden rounded-3xl bg-white/5 ring-1 ring-white/10 sm:h-80">
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            height: `${fill}%`,
            background: `linear-gradient(to top, ${theme.dark}, ${theme.base})`,
            transition: `height ${FILL_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <span
              className="grid size-8 place-items-center rounded-full text-sm font-black transition-colors duration-500 sm:size-10 sm:text-base"
              style={{
                backgroundColor:
                  ranked && rank === 1 ? "#ffffff" : "rgba(255,255,255,0.18)",
                color: ranked && rank === 1 ? theme.dark : "#ffffff",
              }}
            >
              {ranked ? rank : "–"}
            </span>
            {ranked && rank === 1 && (
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
              {shown.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Held back until the house is revealed — showing a house's top scorers
          while its bar still reads zero gives the result away. */}
      <div
        className="overflow-hidden rounded-3xl bg-white/5 ring-1 ring-white/10"
        style={{
          opacity: phase === "pending" ? 0 : 1,
          transition: `opacity ${FILL_MS}ms ease-out`,
        }}
        aria-hidden={phase === "pending"}
      >
        <div
          className="px-4 py-2 text-sm font-black uppercase tracking-widest sm:text-base"
          style={{ backgroundColor: theme.base, color: theme.ink }}
        >
          {house}
        </div>
        <div className="p-4">
          <DetailList
            title="Top students"
            colour={theme.base}
            rows={students.map((s) => ({ key: String(s.id), label: s.name, value: s.points }))}
          />
          <div className="mt-5">
            <DetailList
              title="Top classes"
              colour={theme.base}
              rows={classes.map((c) => ({
                key: c.classCode,
                label: c.classCode,
                value: c.points,
              }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailList({
  title,
  colour,
  rows,
}: {
  title: string;
  colour: string;
  rows: { key: string; label: string; value: number }[];
}) {
  return (
    <>
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/40">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-white/30">No points yet</p>
      ) : (
        <ol className="mt-2 space-y-1.5">
          {rows.map((row, i) => (
            <li key={row.key} className="flex items-baseline gap-2 text-sm">
              <span className="w-4 shrink-0 font-bold text-white/30 tabular-nums">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium" title={row.label}>
                {row.label}
              </span>
              <span className="shrink-0 font-bold tabular-nums" style={{ color: colour }}>
                {row.value.toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

/** Counts 0 → target while filling; otherwise reports the value directly. */
function useCountUp(target: number, phase: Phase): number {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    if (phase !== "filling") return;
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - started) / FILL_MS, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimated(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, phase]);

  if (phase === "pending") return 0;
  if (phase === "settled") return target;
  return animated;
}

/**
 * FLIP: measure where each column was, let React reorder the DOM, then play it
 * back from its old position. Measuring real positions means this works for the
 * four-across projector layout and the two-by-two phone layout alike.
 *
 * Uses the Web Animations API rather than inline styles plus requestAnimationFrame.
 * That earlier approach set the "invert" transform in one frame and cleared it in
 * the next, so anything that interrupted the pair — an effect re-run, a cancelled
 * frame — stranded a column at an offset it never recovered from. A cancelled
 * WAAPI animation simply snaps to the layout position and leaves no styles behind.
 */
function useFlip(orderKey: string) {
  const containerRef = useRef<HTMLElement>(null);
  const previous = useRef(new Map<string, DOMRect>());

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const columns = Array.from(
      container.querySelectorAll<HTMLElement>("[data-house]"),
    );

    // Finish any slide still in flight so the rects below describe layout
    // positions rather than partially-transformed ones.
    for (const column of columns) {
      for (const animation of column.getAnimations()) animation.cancel();
    }

    const running: Animation[] = [];

    for (const column of columns) {
      const house = column.dataset.house;
      if (!house) continue;

      const next = column.getBoundingClientRect();
      const prev = previous.current.get(house);
      previous.current.set(house, next);
      if (!prev) continue;

      const dx = prev.left - next.left;
      const dy = prev.top - next.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;

      running.push(
        column.animate(
          [
            { transform: `translate(${dx}px, ${dy}px)` },
            { transform: "translate(0px, 0px)" },
          ],
          { duration: SLIDE_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        ),
      );
    }

    return () => {
      for (const animation of running) animation.cancel();
    };
  }, [orderKey]);

  return containerRef;
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}
