import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { GovernanceClient } from "@/components/bi/ExecutiveClients";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  return <GovernanceClient user={toSafeUser(session.user)} view="decisions" />;
}
