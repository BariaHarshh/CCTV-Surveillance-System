import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { IncidentTasksClient } from "@/components/admin/IncidentTasksClient";

export default async function IncidentTasksPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  const { id } = await params;
  if (!session) return null;
  return <IncidentTasksClient user={toSafeUser(session.user)} incidentId={id} />;
}
