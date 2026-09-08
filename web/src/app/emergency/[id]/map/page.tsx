import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { EmergencyMapClient } from "@/components/map/EmergencyMapClient";

export default async function EmergencyMapPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <EmergencyMapClient user={toSafeUser(session.user)} />;
}
