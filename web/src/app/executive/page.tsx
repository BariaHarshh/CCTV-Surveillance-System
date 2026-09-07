import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { ExecutiveCommandClient } from "@/components/bi/ExecutiveClients";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  return <ExecutiveCommandClient user={toSafeUser(session.user)} view="command" />;
}
