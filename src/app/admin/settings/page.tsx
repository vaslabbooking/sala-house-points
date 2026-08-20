import { requireAdmin } from "@/lib/guard";
import { SETTING, getSetting } from "@/lib/settings";
import { SettingsPanel } from "@/components/SettingsPanel";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const [code, enabled, publicDisplay] = await Promise.all([
    getSetting(SETTING.accessCode),
    getSetting(SETTING.accessCodeEnabled),
    getSetting(SETTING.publicDisplay),
  ]);

  return (
    <SettingsPanel
      accessCode={code ?? ""}
      accessEnabled={enabled === "1"}
      publicDisplay={publicDisplay === "1"}
    />
  );
}
