import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { PoliciesClient } from "@/components/enterprise/EnterpriseClients";

export default async function AdminPoliciesPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <PoliciesClient user={toSafeUser(session.user)} />;
}
