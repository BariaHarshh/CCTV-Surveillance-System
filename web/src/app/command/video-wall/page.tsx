import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { VideoWallClient } from "@/components/video/VideoWallClient";

export default async function VideoWallPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <VideoWallClient user={toSafeUser(session.user)} />;
}
