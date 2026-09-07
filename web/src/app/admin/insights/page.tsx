import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { InsightsClient } from "@/components/analytics/InsightsClient";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  return <InsightsClient user={toSafeUser(session.user)} />;
}
