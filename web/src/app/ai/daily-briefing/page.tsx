import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { DailyBriefingClient } from "@/components/intelligence/IntelligenceClients";

export default async function DailyBriefingPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <DailyBriefingClient user={toSafeUser(session.user)} />;
}
