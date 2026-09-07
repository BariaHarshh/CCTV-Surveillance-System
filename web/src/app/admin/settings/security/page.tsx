import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { SecuritySettingsClient } from "@/components/platform/SecuritySettingsClient";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  return <SecuritySettingsClient user={toSafeUser(session.user)} />;
}
