import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { AutomationTemplatesClient } from "@/components/enterprise/EnterpriseClients";

export default async function AdminAutomationTemplatesPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <AutomationTemplatesClient user={toSafeUser(session.user)} />;
}
