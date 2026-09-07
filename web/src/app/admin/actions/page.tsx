import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { ActionsClient } from "@/components/analytics/ActionsClient";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  return <ActionsClient user={toSafeUser(session.user)} />;
}
