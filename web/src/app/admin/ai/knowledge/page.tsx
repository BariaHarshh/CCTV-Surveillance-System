import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { KnowledgeAdminClient } from "@/components/intelligence/IntelligenceClients";

export default async function KnowledgePage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <KnowledgeAdminClient user={toSafeUser(session.user)} />;
}
