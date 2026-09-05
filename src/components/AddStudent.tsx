"use client";

import { useState, useTransition } from "react";
import { createStudent } from "@/app/admin/actions";
import { HOUSES, HOUSE_THEME, type House } from "@/lib/houses";

const EMPTY = { name: "", classCode: "", house: "" as House | "" };

/**
 * For a student arriving part-way through the year. Deliberately separate from
 * the CSV import: that replaces the whole list, which is the wrong tool for one
 * new arrival.
 */
export function AddStudent({ classCodes }: { classCodes: string[] }) {
  const [draft, setDraft] = useState(EMPTY);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await createStudent({
        name: draft.name,
        classCode: draft.classCode,
        house: draft.house,
      });
      setNote({ text: result.message, ok: result.ok });
      // Keep the class and house on success: new arrivals often come in groups.
      if (result.ok) setDraft((current) => ({ ...current, name: "" }));
    });
  }

  const ready = draft.name.trim() && draft.classCode.trim() && draft.house;

  return (
    <section className="mt-5 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <h2 className="text-base font-bold text-ink">Add a student</h2>
      <p className="mt-1 text-sm text-ink-soft">
        For someone joining mid-year or transferring in. They start on zero
        points and appear in their class straight away.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && ready && !pending) submit();
          }}
          placeholder="Full name"
          aria-label="Student name"
          className="min-w-0 rounded-xl border border-line bg-surface px-4 py-2.5 text-base text-ink outline-none focus:border-sharks focus:ring-2 focus:ring-sharks/25"
        />

        <input
          list="add-student-classes"
          value={draft.classCode}
          onChange={(e) => setDraft({ ...draft, classCode: e.target.value })}
          placeholder="Class"
          aria-label="Class"
          className="min-w-0 rounded-xl border border-line bg-surface px-4 py-2.5 text-base text-ink outline-none focus:border-sharks focus:ring-2 focus:ring-sharks/25"
        />
        <datalist id="add-student-classes">
          {classCodes.map((code) => (
            <option key={code} value={code} />
          ))}
        </datalist>

        <select
          value={draft.house}
          onChange={(e) => setDraft({ ...draft, house: e.target.value as House })}
          aria-label="House"
          className="min-w-0 rounded-xl border border-line bg-surface px-4 py-2.5 text-base text-ink outline-none focus:border-sharks focus:ring-2 focus:ring-sharks/25"
          style={
            draft.house
              ? {
                  borderColor: HOUSE_THEME[draft.house].base,
                  color: HOUSE_THEME[draft.house].dark,
                  fontWeight: 600,
                }
              : undefined
          }
        >
          <option value="">House…</option>
          {HOUSES.map((house) => (
            <option key={house} value={house}>
              {house}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={submit}
          disabled={!ready || pending}
          className="rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>

      {note && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${
            note.ok ? "bg-bears/10 text-bears-dark" : "bg-tigers/10 text-tigers-dark"
          }`}
        >
          {note.text}
        </p>
      )}
    </section>
  );
}
