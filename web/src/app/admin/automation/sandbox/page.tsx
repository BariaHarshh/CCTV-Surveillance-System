import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { AutomationSandboxClient } from "@/components/enterprise/EnterpriseClients";

export default async function AdminAutomationSandboxPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <AutomationSandboxClient user={toSafeUser(session.user)} />;
}
