import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { OpsDashClient } from "@/components/mobile/MobileOpsClients";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  return <OpsDashClient user={toSafeUser(session.user)} view="inspections" />;
}
