import { requireAdmin } from "@/lib/guard";
import { getAwardLog } from "@/lib/admin";
import { AwardLog } from "@/components/AwardLog";

export const dynamic = "force-dynamic";

export default async function AdminLogPage() {
  await requireAdmin();
  const entries = await getAwardLog(200);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Award log</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Every submission, newest first. Reversing one removes its points from
            all totals but keeps the record.
          </p>
        </div>
        <a
          href="/admin/export"
          className="rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-bold text-ink"
        >
          Export CSV
        </a>
      </div>

      <AwardLog entries={entries} />
    </div>
  );
}
