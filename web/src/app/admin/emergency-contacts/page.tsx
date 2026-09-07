import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { EmergencyContactsClient } from "@/components/admin/EmergencyContactsClient";

export default async function EmergencyContactsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <EmergencyContactsClient user={toSafeUser(session.user)} />;
}
