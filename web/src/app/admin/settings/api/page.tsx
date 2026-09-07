import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { ApiKeysClient } from "@/components/platform/ApiKeysClient";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  return <ApiKeysClient user={toSafeUser(session.user)} />;
}
