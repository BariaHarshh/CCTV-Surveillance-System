import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { AiAgentToolsClient } from "@/components/enterprise/EnterpriseClients";

export default async function SuperAdminAiAgentToolsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <AiAgentToolsClient user={toSafeUser(session.user)} />;
}
