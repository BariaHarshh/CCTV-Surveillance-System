import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { EmergencyDetailClient } from "@/components/admin/EmergencyDetailClient";

export default async function EmergencyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  const { id } = await params;
  if (!session) return null;
  return <EmergencyDetailClient user={toSafeUser(session.user)} emergencyId={id} />;
}
