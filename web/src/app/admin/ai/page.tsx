import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { AIIntelligenceClient } from "@/components/admin/AIIntelligenceClient";

export default async function AdminAIPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <AIIntelligenceClient user={toSafeUser(session.user)} />;
}
