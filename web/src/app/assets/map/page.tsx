import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { AssetMapClient } from "@/components/map/AssetMapClient";

export default async function AssetsMapPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <AssetMapClient user={toSafeUser(session.user)} />;
}
