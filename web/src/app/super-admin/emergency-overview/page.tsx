import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { EmergencyOverviewClient } from "@/components/super-admin/EmergencyOverviewClient";

export default async function SuperAdminEmergencyOverviewPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <EmergencyOverviewClient user={toSafeUser(session.user)} />;
}
