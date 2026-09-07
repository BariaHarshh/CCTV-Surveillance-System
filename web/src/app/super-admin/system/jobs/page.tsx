import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { SystemJobsClient } from "@/components/enterprise/EnterpriseClients";

export default async function SuperAdminJobsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <SystemJobsClient user={toSafeUser(session.user)} />;
}
