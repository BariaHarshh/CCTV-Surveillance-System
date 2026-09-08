import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { SupportClient } from "@/components/enterprise/EnterpriseClients";

export default async function SupportPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <SupportClient user={toSafeUser(session.user)} />;
}
