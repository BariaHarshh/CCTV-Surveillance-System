import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { FloorOverviewClient } from "@/components/map/FloorOverviewClient";

export default async function FloorPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <FloorOverviewClient user={toSafeUser(session.user)} />;
}
