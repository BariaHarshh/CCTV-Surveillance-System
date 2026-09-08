import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { SuperAdminTestingClient } from "@/components/intelligence/IntelligenceClients";

export default async function SuperAdminAITestingPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <SuperAdminTestingClient user={toSafeUser(session.user)} />;
}
