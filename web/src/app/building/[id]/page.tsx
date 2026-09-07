import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { BuildingOverviewClient } from "@/components/map/BuildingOverviewClient";

export default async function BuildingPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <BuildingOverviewClient user={toSafeUser(session.user)} />;
}
