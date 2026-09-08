import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { AuditLogsPageClient } from "@/components/super-admin/AuditLogsPageClient";

export default async function AuditLogsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <AuditLogsPageClient user={toSafeUser(session.user)} />;
}
