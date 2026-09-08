import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { TeamWorkspaceClient } from "@/components/enterprise/EnterpriseClients";

export default async function TeamPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <TeamWorkspaceClient user={toSafeUser(session.user)} />;
}
