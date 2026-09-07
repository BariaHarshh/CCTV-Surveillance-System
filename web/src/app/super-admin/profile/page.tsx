import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { ProfilePageClient } from "@/components/super-admin/ProfilePageClient";

export default async function ProfilePage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <ProfilePageClient user={toSafeUser(session.user)} />;
}
