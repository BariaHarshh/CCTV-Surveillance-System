import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { SystemReadinessClient } from "@/components/enterprise/EnterpriseClients";

export default async function AdminSystemReadinessPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <SystemReadinessClient user={toSafeUser(session.user)} />;
}
