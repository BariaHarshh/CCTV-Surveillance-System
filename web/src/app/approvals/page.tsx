import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { ApprovalsClient } from "@/components/enterprise/EnterpriseClients";

export default async function ApprovalsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <ApprovalsClient user={toSafeUser(session.user)} />;
}
