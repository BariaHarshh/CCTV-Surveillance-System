import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { CampusOverviewClient } from "@/components/map/CampusOverviewClient";

export default async function CampusPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <CampusOverviewClient user={toSafeUser(session.user)} />;
}
