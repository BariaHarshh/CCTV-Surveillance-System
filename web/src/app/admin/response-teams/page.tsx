import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { ResponseTeamsClient } from "@/components/admin/ResponseTeamsClient";

export default async function ResponseTeamsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <ResponseTeamsClient user={toSafeUser(session.user)} />;
}
