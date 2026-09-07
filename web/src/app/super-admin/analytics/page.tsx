import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { SuperAdminAnalyticsClient } from "@/components/analytics/SuperAdminAnalyticsClient";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  return <SuperAdminAnalyticsClient user={toSafeUser(session.user)} />;
}
