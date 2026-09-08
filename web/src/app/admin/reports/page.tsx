import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { ReportsClient } from "@/components/analytics/ReportsClient";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  return <ReportsClient user={toSafeUser(session.user)} />;
}
