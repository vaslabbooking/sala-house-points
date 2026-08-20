import { requireAdmin } from "@/lib/guard";
import { getTeacherStats } from "@/lib/admin";
import { TeacherManager } from "@/components/TeacherManager";

export const dynamic = "force-dynamic";

export default async function AdminTeachersPage() {
  await requireAdmin();
  const teachers = await getTeacherStats();
  return <TeacherManager teachers={teachers} />;
}
