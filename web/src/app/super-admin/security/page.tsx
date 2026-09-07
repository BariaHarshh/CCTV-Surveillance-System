import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { SecurityPageClient } from "@/components/super-admin/SecurityPageClient";

export default async function SecurityPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <SecurityPageClient user={toSafeUser(session.user)} />;
}
