import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { PredictiveRiskClient } from "@/components/intelligence/IntelligenceClients";

export default async function PredictiveRiskPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <PredictiveRiskClient user={toSafeUser(session.user)} />;
}
