"use client";

import { useState, useTransition } from "react";
import {
  changeAdminPassword,
  saveAccessCode,
  saveDisplaySettings,
  type AccessSettings,
  type DisplaySettings,
} from "@/app/admin/actions";

type Note = { text: string; ok: boolean } | null;

/**
 * Every control here is driven by state that is replaced with whatever the
 * server confirms it stored. These panels deliberately avoid `<form action>`:
 * React resets a form once its action resolves, which snapped the checkboxes
 * back to their pre-save values and made a saved setting look like it had been
 * rejected.
 */
export function SettingsPanel({
  access: initialAccess,
  display: initialDisplay,
}: {
  access: AccessSettings;
  display: DisplaySettings;
}) {
  const [access, setAccess] = useState(initialAccess);
  const [display, setDisplay] = useState(initialDisplay);
  const [accessNote, setAccessNote] = useState<Note>(null);
  const [displayNote, setDisplayNote] = useState<Note>(null);
  const [passwordNote, setPasswordNote] = useState<Note>(null);
  const [password, setPassword] = useState({ current: "", next: "" });
  const [pending, startTransition] = useTransition();

  function submitAccess() {
    startTransition(async () => {
      const result = await saveAccessCode(access);
      setAccess(result.settings);
      setAccessNote({ text: result.message, ok: result.ok });
    });
  }

  function submitDisplay() {
    startTransition(async () => {
      const result = await saveDisplaySettings(display);
      setDisplay(result.settings);
      setDisplayNote({ text: result.message, ok: result.ok });
    });
  }

  function submitPassword() {
    startTransition(async () => {
      const result = await changeAdminPassword(password.current, password.next);
      setPasswordNote({ text: result.message, ok: result.ok });
      if (result.ok) setPassword({ current: "", next: "" });
    });
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Settings</h1>

      <Panel title="Staff access code">
        <p className="text-sm text-ink-soft">
          One code for the whole school. Staff type it once on each device and
          stay signed in for the rest of the term. Without it, anyone with the
          link can award points.
        </p>

        <div className="mt-4 space-y-3">
          <Check
            label="Require an access code"
            checked={access.enabled}
            onChange={(enabled) => setAccess({ ...access, enabled })}
          />
          <input
            value={access.code}
            onChange={(e) => setAccess({ ...access, code: e.target.value })}
            placeholder="e.g. SALABEST"
            autoCapitalize="characters"
            className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-base font-bold uppercase tracking-widest text-ink outline-none focus:border-sharks focus:ring-2 focus:ring-sharks/25"
          />
          <SaveButton onClick={submitAccess} pending={pending}>
            Save access code
          </SaveButton>
        </div>
        <NoteLine note={accessNote} />
      </Panel>

      <Panel title="Leaderboard">
        <p className="text-sm text-ink-soft">
          Controls the assembly screen at{" "}
          <code className="font-mono text-xs">/display</code>.
        </p>

        <div className="mt-4 space-y-4">
          <Check
            label="Animated reveal"
            checked={display.animate}
            onChange={(animate) => setDisplay({ ...display, animate })}
            hint="Bars start empty in B.E.S.T order, then fill one house at a time with the totals counting up, each sliding into its rank as it lands. Press R on the display to run it again. Switch this off to show the final standings straight away."
          />
          <Check
            label="Mascot burst"
            checked={display.mascot}
            onChange={(mascot) => setDisplay({ ...display, mascot })}
            hint="The winning house's mascot rushes out of the centre of the screen and fades as it passes. Artwork lives in public/mascots/ — drop in bears.png (or .svg, .webp, .jpg) and the rest to use your own crests."
          />
          <Check
            label="Mascot sound"
            checked={display.sound}
            onChange={(sound) => setDisplay({ ...display, sound })}
            hint="Plays the winning house's sound with the burst, from public/sounds/. Browsers block audio until the page has been clicked, so the display offers an “Enable sound” button when that happens."
          />
          <Check
            label="Open without the access code"
            checked={display.publicDisplay}
            onChange={(publicDisplay) => setDisplay({ ...display, publicDisplay })}
            hint="Lets a hall or reception screen show the leaderboard with nothing to type. It does list student names, so leave this off if the link might travel beyond staff."
          />
          <SaveButton onClick={submitDisplay} pending={pending}>
            Save leaderboard settings
          </SaveButton>
        </div>
        <NoteLine note={displayNote} />
      </Panel>

      <Panel title="Admin password">
        <p className="text-sm text-ink-soft">
          Protects this area only. Keep it different from the staff access code.
        </p>

        <div className="mt-4 space-y-3">
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Current password"
            value={password.current}
            onChange={(e) => setPassword({ ...password, current: e.target.value })}
            className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-base text-ink outline-none focus:border-sharks focus:ring-2 focus:ring-sharks/25"
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="New password (8+ characters)"
            value={password.next}
            onChange={(e) => setPassword({ ...password, next: e.target.value })}
            className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-base text-ink outline-none focus:border-sharks focus:ring-2 focus:ring-sharks/25"
          />
          <SaveButton onClick={submitPassword} pending={pending}>
            Change password
          </SaveButton>
        </div>
        <NoteLine note={passwordNote} />
      </Panel>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <h2 className="text-base font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Check({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 rounded border-line"
      />
      <span className="text-sm text-ink">
        <span className="font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-ink-soft">{hint}</span>}
      </span>
    </label>
  );
}

function SaveButton({
  onClick,
  pending,
  children,
}: {
  onClick: () => void;
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
    >
      {pending ? "Saving…" : children}
    </button>
  );
}

function NoteLine({ note }: { note: Note }) {
  if (!note) return null;
  return (
    <p
      className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${
        note.ok ? "bg-bears/10 text-bears-dark" : "bg-tigers/10 text-tigers-dark"
      }`}
    >
      {note.text}
    </p>
  );
}
