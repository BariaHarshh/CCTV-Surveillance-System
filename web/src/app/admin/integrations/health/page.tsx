import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { IntegrationsHealthClient } from "@/components/enterprise/EnterpriseClients";

export default async function AdminIntegrationsHealthPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <IntegrationsHealthClient user={toSafeUser(session.user)} />;
}
