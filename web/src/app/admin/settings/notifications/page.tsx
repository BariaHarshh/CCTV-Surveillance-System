import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { AISettingsClient } from "@/components/admin/AISettingsClient";

export default async function NotificationRulesPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <AISettingsClient user={toSafeUser(session.user)} variant="notifications" />;
}
