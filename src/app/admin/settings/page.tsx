import { requireAdmin } from "@/lib/guard";
import { SETTING, getFlag, getSetting } from "@/lib/settings";
import { SettingsPanel } from "@/components/SettingsPanel";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdmin();

  const [code, enabled, animate, mascot, sound, publicDisplay] = await Promise.all([
    getSetting(SETTING.accessCode),
    getFlag(SETTING.accessCodeEnabled, false),
    getFlag(SETTING.animateDisplay, true),
    getFlag(SETTING.mascotBurst, true),
    getFlag(SETTING.mascotSound, false),
    getFlag(SETTING.publicDisplay, false),
  ]);

  return (
    <SettingsPanel
      access={{ enabled, code: code ?? "" }}
      display={{ animate, mascot, sound, publicDisplay }}
    />
  );
}
