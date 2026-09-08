import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { OrgAuditClient } from "@/components/platform/OrgAuditClient";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  return <OrgAuditClient user={toSafeUser(session.user)} />;
}
