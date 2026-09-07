import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { OrganizationSettingsClient } from "@/components/platform/OrganizationSettingsClient";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  return <OrganizationSettingsClient user={toSafeUser(session.user)} />;
}
