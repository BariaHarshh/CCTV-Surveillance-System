import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { ExecutiveDashboardClient } from "@/components/analytics/ExecutiveDashboardClient";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  return <ExecutiveDashboardClient user={toSafeUser(session.user)} />;
}
