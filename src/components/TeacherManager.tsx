"use client";

import { useState, useTransition } from "react";
import { createTeacher, toggleTeacher } from "@/app/admin/actions";
import type { TeacherStat } from "@/lib/admin";

export function TeacherManager({ teachers }: { teachers: TeacherStat[] }) {
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const active = teachers.filter((t) => t.active);
  const removed = teachers.filter((t) => !t.active);

  function add(formData: FormData) {
    startTransition(async () => {
      const result = await createTeacher(formData);
      setMessage({ text: result.message, ok: result.ok });
    });
  }

  function setActive(id: number, next: boolean) {
    startTransition(async () => {
      const result = await toggleTeacher(id, next);
      setMessage({ text: result.message, ok: result.ok });
    });
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Teachers</h1>
      <p className="mt-1 text-sm text-ink-soft">
        These names fill the picker on the entry screen.
      </p>

      <form
        action={add}
        className="mt-5 flex flex-wrap gap-2 rounded-2xl border border-line bg-surface p-4"
      >
        <input
          name="name"
          required
          placeholder="Add a teacher…"
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 text-base text-ink outline-none focus:border-sharks focus:ring-2 focus:ring-sharks/25"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          Add
        </button>
      </form>

      {message && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${
            message.ok ? "bg-bears/10 text-bears-dark" : "bg-tigers/10 text-tigers-dark"
          }`}
        >
          {message.text}
        </p>
      )}

      <ul className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {active.map((teacher) => (
          <li key={teacher.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">{teacher.name}</p>
              <p className="text-xs text-ink-soft">
                {teacher.points.toLocaleString()} points · {teacher.submissions}{" "}
                {teacher.submissions === 1 ? "submission" : "submissions"}
                {teacher.lastAward ? ` · last ${formatDate(teacher.lastAward)}` : " · never used"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActive(teacher.id, false)}
              disabled={pending}
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-tigers hover:text-tigers disabled:opacity-50"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      {removed.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold text-ink-soft">Removed</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Kept so their past awards still show a name in the log.
          </p>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {removed.map((teacher) => (
              <li key={teacher.id} className="flex items-center gap-3 px-4 py-3">
                <p className="min-w-0 flex-1 text-ink-soft">{teacher.name}</p>
                <button
                  type="button"
                  onClick={() => setActive(teacher.id, true)}
                  disabled={pending}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-bears hover:text-bears-dark disabled:opacity-50"
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso.replace(" ", "T") + "Z");
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
