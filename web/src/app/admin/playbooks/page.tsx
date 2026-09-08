import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { PlaybooksClient } from "@/components/admin/PlaybooksClient";

export default async function PlaybooksPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <PlaybooksClient user={toSafeUser(session.user)} />;
}
