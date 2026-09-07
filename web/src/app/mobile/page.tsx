import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { MobileHomeClient } from "@/components/mobile/MobileHomeClient";

export default async function MobileHomePage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <MobileHomeClient user={toSafeUser(session.user)} />;
}
