import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { SuperAdminObservabilityClient } from "@/components/intelligence/IntelligenceClients";

export default async function SuperAdminAIObservabilityPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <SuperAdminObservabilityClient user={toSafeUser(session.user)} />;
}
