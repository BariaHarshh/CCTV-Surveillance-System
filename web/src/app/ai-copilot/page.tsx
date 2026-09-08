import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { CopilotClient } from "@/components/intelligence/CopilotClient";

export default async function AICopilotPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <CopilotClient user={toSafeUser(session.user)} />;
}
