import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { EmergencyReportClient } from "@/components/admin/EmergencyReportClient";

export default async function EmergencyReportPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  const { id } = await params;
  if (!session) return null;
  return <EmergencyReportClient user={toSafeUser(session.user)} emergencyId={id} />;
}
