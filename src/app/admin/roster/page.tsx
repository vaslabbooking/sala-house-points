import { requireAdmin } from "@/lib/guard";
import { searchStudents } from "@/lib/admin";
import { getClassCodes } from "@/lib/queries";
import { getCurrentYear } from "@/lib/settings";
import { StudentTable } from "@/components/StudentTable";
import { RosterImport } from "@/components/RosterImport";

export const dynamic = "force-dynamic";

export default async function AdminRosterPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const { q } = await searchParams;
  const query = q ?? "";

  const [students, classCodes, year] = await Promise.all([
    searchStudents(query),
    getClassCodes(),
    getCurrentYear(),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Students</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Move students between classes or houses, or replace the whole roster.
      </p>

      <div className="mt-5">
        <RosterImport currentYear={year.name} />
      </div>

      <StudentTable students={students} classCodes={classCodes} query={query} />
    </div>
  );
}
