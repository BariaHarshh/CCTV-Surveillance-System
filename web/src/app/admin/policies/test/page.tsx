import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { PolicyTestClient } from "@/components/enterprise/EnterpriseClients";

export default async function AdminPolicyTestPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <PolicyTestClient user={toSafeUser(session.user)} />;
}
