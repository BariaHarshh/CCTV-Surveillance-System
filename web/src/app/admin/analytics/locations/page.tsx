import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { AnalyticsDomainClient } from "@/components/analytics/AnalyticsDomainClient";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  return <AnalyticsDomainClient user={toSafeUser(session.user)} domain="locations" />;
}
