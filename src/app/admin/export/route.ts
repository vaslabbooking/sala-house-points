import { isAdmin } from "@/lib/auth";
import {
  exportAwardsCsv,
  exportStudentTotalsCsv,
  getYearName,
} from "@/lib/admin";
import { getCurrentYear } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * CSV export. Defaults to the current year and the full award log; `year` and
 * `format` reach an archived year or the per-student summary instead.
 *
 *   /admin/export                        current year, full ledger
 *   /admin/export?year=3&format=totals   archived year, final standings
 */
export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return new Response("Not authorised", { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const format = params.get("format") === "totals" ? "totals" : "awards";
  const requested = params.get("year");

  let yearId: number | undefined;
  let yearName: string;

  if (requested) {
    const parsed = Number(requested);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return new Response("Unknown school year", { status: 400 });
    }
    const name = await getYearName(parsed);
    if (!name) return new Response("Unknown school year", { status: 404 });
    yearId = parsed;
    yearName = name;
  } else {
    yearName = (await getCurrentYear()).name;
  }

  const csv =
    format === "totals"
      ? await exportStudentTotalsCsv(yearId)
      : await exportAwardsCsv(yearId);

  // Year names contain spaces and brackets; keep the filename plain.
  const slug = yearName.replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-|-$/g, "");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="house-points-${slug}-${format}.csv"`,
    },
  });
}
