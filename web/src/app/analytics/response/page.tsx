import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { AnalyticsAliasClient } from "@/components/bi/ExecutiveClients";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  return <AnalyticsAliasClient user={toSafeUser(session.user)} domain="response" />;
}
