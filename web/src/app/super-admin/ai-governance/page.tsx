import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { AiGovernanceClient } from "@/components/enterprise/EnterpriseClients";

export default async function SuperAdminAiGovernancePage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <AiGovernanceClient user={toSafeUser(session.user)} />;
}
