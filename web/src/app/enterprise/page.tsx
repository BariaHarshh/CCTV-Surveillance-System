import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { EnterpriseDashboardClient } from "@/components/enterprise/EnterpriseClients";

export default async function EnterprisePage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <EnterpriseDashboardClient user={toSafeUser(session.user)} />;
}
