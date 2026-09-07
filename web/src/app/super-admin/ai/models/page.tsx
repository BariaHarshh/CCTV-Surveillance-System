import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { SuperAdminModelsClient } from "@/components/intelligence/IntelligenceClients";

export default async function SuperAdminAIModelsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <SuperAdminModelsClient user={toSafeUser(session.user)} />;
}
