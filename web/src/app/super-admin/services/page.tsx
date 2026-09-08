import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { ServicesCatalogClient } from "@/components/enterprise/EnterpriseClients";

export default async function SuperAdminServicesPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <ServicesCatalogClient user={toSafeUser(session.user)} />;
}
