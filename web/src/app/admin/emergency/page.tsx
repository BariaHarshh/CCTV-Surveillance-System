import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { EmergencyActivateClient } from "@/components/admin/EmergencyActivateClient";

export default async function EmergencyActivatePage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <EmergencyActivateClient user={toSafeUser(session.user)} />;
}
