import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { UsersPageClient } from "@/components/super-admin/UsersPageClient";

export default async function UsersPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <UsersPageClient currentUser={toSafeUser(session.user)} />;
}
