import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { IncidentsClient } from "@/components/admin/IncidentsClient";

export default async function IncidentsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <IncidentsClient user={toSafeUser(session.user)} />;
}
