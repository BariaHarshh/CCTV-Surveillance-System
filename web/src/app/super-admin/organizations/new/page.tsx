import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { OrganizationWizard } from "@/components/organizations/OrganizationWizard";

export default async function NewOrganizationPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <OrganizationWizard user={toSafeUser(session.user)} />;
}
