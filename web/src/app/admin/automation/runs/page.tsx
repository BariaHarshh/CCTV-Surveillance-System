import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { AutomationRunsClient } from "@/components/enterprise/EnterpriseClients";

export default async function AdminAutomationRunsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <AutomationRunsClient user={toSafeUser(session.user)} />;
}
