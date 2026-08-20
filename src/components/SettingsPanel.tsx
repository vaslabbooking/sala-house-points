"use client";

import { useState, useTransition } from "react";
import { changeAdminPassword, saveAccessCode } from "@/app/admin/actions";

export function SettingsPanel({
  accessCode,
  accessEnabled,
  publicDisplay,
}: {
  accessCode: string;
  accessEnabled: boolean;
  publicDisplay: boolean;
}) {
  const [codeMessage, setCodeMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [enabled, setEnabled] = useState(accessEnabled);
  const [openDisplay, setOpenDisplay] = useState(publicDisplay);
  const [pending, startTransition] = useTransition();

  function submitCode(formData: FormData) {
    startTransition(async () => {
      const result = await saveAccessCode(formData);
      setCodeMessage({ text: result.message, ok: result.ok });
    });
  }

  function submitPassword(formData: FormData) {
    startTransition(async () => {
      const result = await changeAdminPassword(formData);
      setPasswordMessage({ text: result.message, ok: result.ok });
    });
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Settings</h1>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-base font-bold text-ink">Staff access code</h2>
        <p className="mt-1 text-sm text-ink-soft">
          One code for the whole school. Staff type it once on each device and
          stay signed in for the rest of the term. Without it, anyone with the
          link can award points.
        </p>

        <form action={submitCode} className="mt-4 space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="size-4 rounded border-line"
            />
            <span className="text-sm font-medium text-ink">Require an access code</span>
          </label>

          <input
            name="code"
            defaultValue={accessCode}
            placeholder="e.g. SALABEST"
            autoCapitalize="characters"
            className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-base font-bold uppercase tracking-widest text-ink outline-none focus:border-sharks focus:ring-2 focus:ring-sharks/25"
          />

          <label className="flex items-start gap-2 border-t border-line pt-3">
            <input
              type="checkbox"
              name="publicDisplay"
              checked={openDisplay}
              onChange={(e) => setOpenDisplay(e.target.checked)}
              className="mt-0.5 size-4 rounded border-line"
            />
            <span className="text-sm text-ink">
              <span className="font-medium">Leaderboard open without the code</span>
              <span className="mt-0.5 block text-xs text-ink-soft">
                Lets a hall or reception screen show the leaderboard with nothing
                to type. It does list student names, so leave this off if the
                link might travel beyond staff.
              </span>
            </span>
          </label>

          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            Save access code
          </button>
        </form>

        {codeMessage && (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${
              codeMessage.ok ? "bg-bears/10 text-bears-dark" : "bg-tigers/10 text-tigers-dark"
            }`}
          >
            {codeMessage.text}
          </p>
        )}
      </section>

      <section className="mt-5 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-base font-bold text-ink">Admin password</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Protects this area only. Keep it different from the staff access code.
        </p>

        <form action={submitPassword} className="mt-4 space-y-3">
          <input
            type="password"
            name="current"
            required
            autoComplete="current-password"
            placeholder="Current password"
            className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-base text-ink outline-none focus:border-sharks focus:ring-2 focus:ring-sharks/25"
          />
          <input
            type="password"
            name="next"
            required
            autoComplete="new-password"
            placeholder="New password (8+ characters)"
            className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-base text-ink outline-none focus:border-sharks focus:ring-2 focus:ring-sharks/25"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            Change password
          </button>
        </form>

        {passwordMessage && (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${
              passwordMessage.ok ? "bg-bears/10 text-bears-dark" : "bg-tigers/10 text-tigers-dark"
            }`}
          >
            {passwordMessage.text}
          </p>
        )}
      </section>
    </div>
  );
}
