import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { LoginHistoryClient } from "@/components/platform/LoginHistoryClient";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  return <LoginHistoryClient user={toSafeUser(session.user)} />;
}
