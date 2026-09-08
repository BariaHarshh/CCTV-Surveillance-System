import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { MaintenanceClient } from "@/components/platform/SuperAdminPlatformClients";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  return <MaintenanceClient user={toSafeUser(session.user)} />;
}
