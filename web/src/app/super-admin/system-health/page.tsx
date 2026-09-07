import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { SystemHealthPageClient } from "@/components/super-admin/SystemHealthPageClient";

export default async function SystemHealthPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <SystemHealthPageClient user={toSafeUser(session.user)} />;
}
