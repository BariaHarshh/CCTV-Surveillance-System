import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { RecommendationsClient } from "@/components/intelligence/IntelligenceClients";

export default async function RecommendationsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <RecommendationsClient user={toSafeUser(session.user)} />;
}
