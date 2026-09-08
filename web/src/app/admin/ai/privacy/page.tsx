import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { PrivacyAdminClient } from "@/components/intelligence/IntelligenceClients";

export default async function PrivacyPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <PrivacyAdminClient user={toSafeUser(session.user)} />;
}
