import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { OrganizationProfileClient } from "@/components/admin/OrganizationProfileClient";

export default async function AdminOrganizationPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <OrganizationProfileClient user={toSafeUser(session.user)} />;
}
