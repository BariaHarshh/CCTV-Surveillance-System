import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { PlatformIncidentsClient } from "@/components/super-admin/SuperAdminPlatformClients";

export default async function PlatformIncidentsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <PlatformIncidentsClient user={toSafeUser(session.user)} />;
}
