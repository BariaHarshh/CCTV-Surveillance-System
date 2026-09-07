import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { SchedulesClient } from "@/components/admin/SchedulesClient";

export default async function SchedulesPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <SchedulesClient user={toSafeUser(session.user)} />;
}
