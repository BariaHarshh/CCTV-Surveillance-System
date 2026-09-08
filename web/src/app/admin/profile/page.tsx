import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { ProfileClient } from "@/components/platform/AccountClients";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  return <ProfileClient user={toSafeUser(session.user)} />;
}
