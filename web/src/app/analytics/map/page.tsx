import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { MapAnalyticsClient } from "@/components/map/MapAnalyticsClient";

export default async function MapAnalyticsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <MapAnalyticsClient user={toSafeUser(session.user)} />;
}
