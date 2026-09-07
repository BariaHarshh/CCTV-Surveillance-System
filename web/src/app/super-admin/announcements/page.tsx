import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { AnnouncementsClient } from "@/components/platform/SuperAdminPlatformClients";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  return <AnnouncementsClient user={toSafeUser(session.user)} />;
}
