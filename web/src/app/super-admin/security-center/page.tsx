import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { SecurityCenterPageClient } from "@/components/super-admin/SecurityCenterPageClient";

export default async function SecurityCenterPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <SecurityCenterPageClient user={toSafeUser(session.user)} />;
}
