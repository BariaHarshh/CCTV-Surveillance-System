import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { TeamsClient } from "@/components/mobile/MobileOpsClients";

export default async function Page({ params }: { params: Promise<{ teamId: string }> }) {
  const session = await getAuthSession();
  if (!session) return null;
  const { teamId } = await params;
  return <TeamsClient user={toSafeUser(session.user)} teamId={teamId} />;
}
