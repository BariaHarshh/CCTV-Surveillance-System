import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { StorageRetentionClient } from "@/components/platform/StorageRetentionClient";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  return <StorageRetentionClient user={toSafeUser(session.user)} />;
}
