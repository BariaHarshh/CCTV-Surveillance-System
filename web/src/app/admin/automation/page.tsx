import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { AutomationDashboardClient } from "@/components/enterprise/EnterpriseClients";

export default async function AdminAutomationPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <AutomationDashboardClient user={toSafeUser(session.user)} />;
}
