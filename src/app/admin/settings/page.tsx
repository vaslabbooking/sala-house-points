import { requireAdmin } from "@/lib/guard";
import { SETTING, getFlag, getSetting } from "@/lib/settings";
import { SettingsPanel } from "@/components/SettingsPanel";
import { YearArchive } from "@/components/YearArchive";
import { listSchoolYears } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdmin();

  const [years, code, enabled, animate, mascot, sound, publicDisplay] = await Promise.all([
    listSchoolYears(),
    getSetting(SETTING.accessCode),
    getFlag(SETTING.accessCodeEnabled, false),
    getFlag(SETTING.animateDisplay, true),
    getFlag(SETTING.mascotBurst, true),
    getFlag(SETTING.mascotSound, false),
    getFlag(SETTING.publicDisplay, false),
  ]);

  return (
    <>
      <SettingsPanel
        access={{ enabled, code: code ?? "" }}
        display={{ animate, mascot, sound, publicDisplay }}
      />
      <div className="mx-auto w-full max-w-2xl px-4 pb-8 sm:px-6">
        <YearArchive years={years} />
      </div>
    </>
  );
}
