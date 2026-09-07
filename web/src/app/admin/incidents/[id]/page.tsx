import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { IncidentDetailClient } from "@/components/admin/IncidentDetailClient";

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  const { id } = await params;
  if (!session) return null;
  return <IncidentDetailClient user={toSafeUser(session.user)} incidentId={id} />;
}
