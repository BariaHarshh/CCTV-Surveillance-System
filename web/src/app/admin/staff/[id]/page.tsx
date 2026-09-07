import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { StaffProfileClient } from "@/components/admin/StaffProfileClient";

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  const { id } = await params;
  if (!session) return null;
  return <StaffProfileClient user={toSafeUser(session.user)} staffId={id} />;
}
