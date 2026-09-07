import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { PlatformSettingsClient } from "@/components/super-admin/PlatformSettingsClient";

export default async function SettingsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <PlatformSettingsClient user={toSafeUser(session.user)} />;
}
