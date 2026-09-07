import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { ExecutiveSummaryClient } from "@/components/intelligence/IntelligenceClients";

export default async function ExecutiveSummaryPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <ExecutiveSummaryClient user={toSafeUser(session.user)} />;
}
