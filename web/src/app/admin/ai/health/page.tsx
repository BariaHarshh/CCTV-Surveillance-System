import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { AIHealthClient } from "@/components/admin/AIHealthClient";

export default async function AIHealthPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <AIHealthClient user={toSafeUser(session.user)} />;
}
