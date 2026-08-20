import { redirect } from "next/navigation";
import { accessCodeRequired, checkAccessCode, grantAccess, hasAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);

  // Nothing to do if the gate is off or this device already has the cookie.
  if (!(await accessCodeRequired()) || (await hasAccess())) redirect(next);

  async function submit(formData: FormData) {
    "use server";
    const code = String(formData.get("code") ?? "");
    const target = safeNext(String(formData.get("next") ?? "/"));
    if (await checkAccessCode(code)) {
      await grantAccess();
      redirect(target);
    }
    redirect(`/access?next=${encodeURIComponent(target)}&error=1`);
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <h1 className="text-lg font-bold text-ink">School access code</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Enter the staff code once — this device will stay signed in for the rest
          of the term.
        </p>
        <form action={submit} className="mt-5 space-y-3">
          <input type="hidden" name="next" value={next} />
          <input
            name="code"
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="Access code"
            className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-center text-lg font-bold tracking-widest text-ink uppercase outline-none focus:border-sharks focus:ring-2 focus:ring-sharks/25"
          />
          {params.error && (
            <p className="text-center text-sm font-medium text-tigers">
              That code was not recognised.
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-xl bg-ink px-4 py-3 text-sm font-bold text-white active:scale-[0.98]"
          >
            Continue
          </button>
        </form>
      </div>
    </main>
  );
}

/** Only ever redirect within this app. */
function safeNext(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
