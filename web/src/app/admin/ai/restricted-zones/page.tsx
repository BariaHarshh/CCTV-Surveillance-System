import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { RestrictedZonesClient } from "@/components/admin/RestrictedZonesClient";

export default async function RestrictedZonesPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <RestrictedZonesClient user={toSafeUser(session.user)} />;
}
