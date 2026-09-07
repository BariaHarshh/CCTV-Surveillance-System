import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { SessionsPageClient } from "@/components/super-admin/SessionsPageClient";

export default async function SessionsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <SessionsPageClient user={toSafeUser(session.user)} />;
}
