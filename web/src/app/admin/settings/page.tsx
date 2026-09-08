import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { SettingsHubClient } from "@/components/platform/SettingsHubClient";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  return <SettingsHubClient user={toSafeUser(session.user)} />;
}
