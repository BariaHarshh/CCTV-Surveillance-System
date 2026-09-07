import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { DeadLetterClient } from "@/components/enterprise/EnterpriseClients";

export default async function SuperAdminDeadLetterPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <DeadLetterClient user={toSafeUser(session.user)} />;
}
