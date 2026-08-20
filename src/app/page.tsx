import { rememberedTeacherId } from "@/lib/auth";
import { requireAccess } from "@/lib/guard";
import { getClassCodes, getTeachers } from "@/lib/queries";
import { EntryScreen } from "@/components/EntryScreen";

// Always current: rosters and teacher lists change from the admin screen.
export const dynamic = "force-dynamic";

export default async function EntryPage() {
  await requireAccess("/");

  const [teachers, classCodes, teacherId] = await Promise.all([
    getTeachers(),
    getClassCodes(),
    rememberedTeacherId(),
  ]);

  const known = teachers.some((t) => t.id === teacherId) ? teacherId : null;

  return (
    <main className="flex-1">
      <EntryScreen teachers={teachers} classCodes={classCodes} initialTeacherId={known} />
    </main>
  );
}
