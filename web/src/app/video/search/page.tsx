import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { VideoIntelligenceClient } from "@/components/video/VideoIntelligenceClient";

export default async function VideoSearchPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <VideoIntelligenceClient user={toSafeUser(session.user)} initialTab="search" />;
}
