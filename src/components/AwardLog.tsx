"use client";

import { useState, useTransition } from "react";
import { adminUndoBatch } from "@/app/actions";
import type { LogEntry } from "@/lib/admin";
import { HOUSE_THEME, isHouse } from "@/lib/houses";

export function AwardLog({ entries }: { entries: LogEntry[] }) {
  const [reversed, setReversed] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reverse(batchId: string) {
    startTransition(async () => {
      const result = await adminUndoBatch(batchId);
      setMessage(result.message);
      if (result.ok) setReversed((prev) => ({ ...prev, [batchId]: true }));
    });
  }

  return (
    <>
      {message && (
        <p className="mt-3 rounded-lg bg-line px-3 py-2 text-sm font-medium text-ink">
          {message}
        </p>
      )}

      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {entries.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-ink-soft">
            No points awarded yet this year.
          </li>
        )}
        {entries.map((entry) => {
          const voided = entry.voided || reversed[entry.batchId];
          return (
            <li
              key={entry.batchId}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
              // Only whole-house awards get a colour stripe: a class batch spans
              // all four houses, so a single colour would be arbitrary.
              style={
                entry.kind === "house" && isHouse(entry.house)
                  ? { borderLeftColor: HOUSE_THEME[entry.house].base, borderLeftWidth: 4 }
                  : undefined
              }
            >
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${voided ? "text-ink-soft line-through" : "text-ink"}`}>
                  <span className="font-bold tabular-nums">
                    {entry.total.toLocaleString()} pts
                  </span>{" "}
                  {entry.kind === "house" ? (
                    <>to all of {entry.house}</>
                  ) : (
                    <>
                      to {entry.count} student{entry.count === 1 ? "" : "s"} in{" "}
                      {entry.classCode ?? "class"}
                    </>
                  )}
                </p>
                <p className="text-xs text-ink-soft">
                  {entry.teacherName} · {formatWhen(entry.createdAt)}
                </p>
              </div>
              {voided ? (
                <span className="text-xs font-semibold text-ink-soft">Reversed</span>
              ) : (
                <button
                  type="button"
                  onClick={() => reverse(entry.batchId)}
                  disabled={pending}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-tigers hover:text-tigers disabled:opacity-50"
                >
                  Reverse
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function formatWhen(iso: string): string {
  const date = new Date(iso.replace(" ", "T") + "Z");
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      });
}
