import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { InvitationsClient } from "@/components/platform/InvitationsClient";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  return <InvitationsClient user={toSafeUser(session.user)} />;
}
