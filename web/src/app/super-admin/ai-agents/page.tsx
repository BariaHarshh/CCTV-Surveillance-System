import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { AiAgentsClient } from "@/components/enterprise/EnterpriseClients";

export default async function SuperAdminAiAgentsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <AiAgentsClient user={toSafeUser(session.user)} />;
}
