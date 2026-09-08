import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { VideoCameraDetailClient } from "@/components/video/VideoCameraDetailClient";

export default async function VideoCameraPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <VideoCameraDetailClient user={toSafeUser(session.user)} />;
}
