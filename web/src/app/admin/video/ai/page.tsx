import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { VideoAdminClients } from "@/components/video/VideoAdminClients";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  return <VideoAdminClients user={toSafeUser(session.user)} view="ai" />;
}
