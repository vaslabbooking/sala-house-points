import { isAdmin } from "@/lib/auth";
import { exportAwardsCsv } from "@/lib/admin";
import { getCurrentYear } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Full ledger download — also what gets copied into SharePoint for the school's own records. */
export async function GET() {
  if (!(await isAdmin())) {
    return new Response("Not authorised", { status: 401 });
  }
  const [csv, year] = await Promise.all([exportAwardsCsv(), getCurrentYear()]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="house-points-${year.name}.csv"`,
    },
  });
}
