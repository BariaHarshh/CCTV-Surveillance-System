import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { WebhooksClient } from "@/components/platform/WebhooksClient";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  return <WebhooksClient user={toSafeUser(session.user)} />;
}
