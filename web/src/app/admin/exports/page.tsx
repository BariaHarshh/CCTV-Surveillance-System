import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { ExportsClient } from "@/components/enterprise/EnterpriseClients";

export default async function AdminExportsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <ExportsClient user={toSafeUser(session.user)} />;
}
