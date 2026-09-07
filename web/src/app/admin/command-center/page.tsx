import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { CommandCenterClient } from "@/components/admin/CommandCenterClient";

export default async function CommandCenterPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <CommandCenterClient user={toSafeUser(session.user)} />;
}
