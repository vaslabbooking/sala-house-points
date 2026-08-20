import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { adminLogin, adminPasswordIsSet, setUpAdminPassword } from "../actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  wrong: "That password is not correct.",
  short: "Password must be at least 8 characters.",
  match: "The two passwords did not match.",
  exists: "An admin password is already set.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isAdmin()) redirect("/admin");
  const { error } = await searchParams;
  const configured = await adminPasswordIsSet();

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <h1 className="text-lg font-bold text-ink">
          {configured ? "Admin sign in" : "Set an admin password"}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {configured
            ? "This area manages the roster, teachers and records."
            : "No admin password exists yet. Choose one now — you will need it to manage the roster."}
        </p>

        {error && ERRORS[error] && (
          <p className="mt-4 rounded-lg bg-tigers/10 px-3 py-2 text-sm font-medium text-tigers-dark">
            {ERRORS[error]}
          </p>
        )}

        <form action={configured ? adminLogin : setUpAdminPassword} className="mt-5 space-y-3">
          <input
            type="password"
            name="password"
            autoFocus
            required
            autoComplete={configured ? "current-password" : "new-password"}
            placeholder={configured ? "Admin password" : "New password"}
            className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none focus:border-sharks focus:ring-2 focus:ring-sharks/25"
          />
          {!configured && (
            <input
              type="password"
              name="confirm"
              required
              autoComplete="new-password"
              placeholder="Confirm password"
              className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none focus:border-sharks focus:ring-2 focus:ring-sharks/25"
            />
          )}
          <button
            type="submit"
            className="w-full rounded-xl bg-ink px-4 py-3 text-sm font-bold text-white active:scale-[0.98]"
          >
            {configured ? "Sign in" : "Set password and continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
