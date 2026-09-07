import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { PostmortemsClient } from "@/components/enterprise/EnterpriseClients";

export default async function SuperAdminPostmortemsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <PostmortemsClient user={toSafeUser(session.user)} />;
}
