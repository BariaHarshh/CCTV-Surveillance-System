import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { EscalationSettingsClient } from "@/components/admin/EscalationSettingsClient";

export default async function EscalationSettingsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <EscalationSettingsClient user={toSafeUser(session.user)} />;
}
