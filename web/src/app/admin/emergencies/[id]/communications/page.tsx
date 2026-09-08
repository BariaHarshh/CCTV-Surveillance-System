import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { EmergencyDetailClient } from "@/components/admin/EmergencyDetailClient";

/** Communications uses the same detail client (messages panel). */
export default async function EmergencyCommunicationsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  const { id } = await params;
  if (!session) return null;
  return <EmergencyDetailClient user={toSafeUser(session.user)} emergencyId={id} />;
}
