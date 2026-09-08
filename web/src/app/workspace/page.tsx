import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { WorkspaceClient } from "@/components/enterprise/EnterpriseClients";

export default async function WorkspacePage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <WorkspaceClient user={toSafeUser(session.user)} />;
}
