import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { OrganizationsListClient } from "@/components/organizations/OrganizationsListClient";

export default async function OrganizationsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <OrganizationsListClient user={toSafeUser(session.user)} />;
}
