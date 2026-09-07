import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { FloorPlanClient } from "@/components/map/FloorPlanClient";

export default async function FloorPlanPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <FloorPlanClient user={toSafeUser(session.user)} />;
}
