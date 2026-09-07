import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { SafetyIntelligenceClient } from "@/components/analytics/SafetyIntelligenceClient";

export default async function AdminAnalyticsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <SafetyIntelligenceClient user={toSafeUser(session.user)} />;
}
