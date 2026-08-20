"use client";

import { useState, useTransition } from "react";
import { toggleStudent, updateStudent } from "@/app/admin/actions";
import { HOUSES, HOUSE_THEME, type House } from "@/lib/houses";
import type { AdminStudent } from "@/lib/admin";
import { HouseBadge } from "./HouseBadge";

export function StudentTable({
  students,
  classCodes,
  query,
}: {
  students: AdminStudent[];
  classCodes: string[];
  query: string;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function save(id: number, classCode: string, house: string) {
    startTransition(async () => {
      const result = await updateStudent(id, classCode, house);
      setMessage({ text: result.message, ok: result.ok });
      if (result.ok) setEditing(null);
    });
  }

  function setActive(id: number, active: boolean) {
    startTransition(async () => {
      const result = await toggleStudent(id, active);
      setMessage({ text: result.message, ok: result.ok });
    });
  }

  return (
    <div className="mt-5">
      <form method="get" className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search by name or class…"
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 text-base text-ink outline-none focus:border-sharks focus:ring-2 focus:ring-sharks/25"
        />
        <button
          type="submit"
          className="rounded-xl border border-line bg-surface px-5 py-2.5 text-sm font-bold text-ink"
        >
          Search
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

      <p className="mt-4 text-xs text-ink-soft">
        Showing {students.length} student{students.length === 1 ? "" : "s"}
        {students.length === 100 && " (first 100 — narrow the search to see more)"}.
        Moving a student to a new class takes their points with them; changing
        house does not move points already earned for the old house.
      </p>

      <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {students.map((student) => (
          <li
            key={student.id}
            className="px-4 py-3"
            style={{
              borderLeftColor: HOUSE_THEME[student.house].base,
              borderLeftWidth: 4,
              opacity: student.active ? 1 : 0.5,
            }}
          >
            {editing === student.id ? (
              <EditRow
                student={student}
                classCodes={classCodes}
                pending={pending}
                onCancel={() => setEditing(null)}
                onSave={save}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{student.name}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-soft">
                    <span>{student.classCode}</span>
                    <HouseBadge house={student.house} size="sm" />
                    <span className="tabular-nums">
                      {student.points.toLocaleString()} pts
                    </span>
                    {!student.active && <span className="font-semibold">Removed</span>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(student.id)}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setActive(student.id, !student.active)}
                  disabled={pending}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-tigers hover:text-tigers disabled:opacity-50"
                >
                  {student.active ? "Remove" : "Restore"}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EditRow({
  student,
  classCodes,
  pending,
  onCancel,
  onSave,
}: {
  student: AdminStudent;
  classCodes: string[];
  pending: boolean;
  onCancel: () => void;
  onSave: (id: number, classCode: string, house: string) => void;
}) {
  const [classCode, setClassCode] = useState(student.classCode);
  const [house, setHouse] = useState<House>(student.house);

  // Free text as well as the existing list, so a brand-new class can be typed in.
  return (
    <div className="flex flex-wrap items-end gap-2">
      <p className="w-full font-medium text-ink">{student.name}</p>

      <label className="flex-1">
        <span className="block text-xs font-semibold text-ink-soft">Class</span>
        <input
          list="class-codes"
          value={classCode}
          onChange={(e) => setClassCode(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-sharks"
        />
      </label>
      <datalist id="class-codes">
        {classCodes.map((code) => (
          <option key={code} value={code} />
        ))}
      </datalist>

      <label className="flex-1">
        <span className="block text-xs font-semibold text-ink-soft">House</span>
        <select
          value={house}
          onChange={(e) => setHouse(e.target.value as House)}
          className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-sharks"
        >
          {HOUSES.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={() => onSave(student.id, classCode, house)}
        disabled={pending}
        className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
      >
        Save
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-soft"
      >
        Cancel
      </button>
    </div>
  );
}
