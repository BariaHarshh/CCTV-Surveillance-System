import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { getOrganizationById } from "@/lib/organizations/service";
import { AdminWizard } from "@/components/organizations/AdminWizard";
import { notFound } from "next/navigation";

export default async function NewAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAuthSession();
  if (!session) return null;
  const { id } = await params;
  const org = await getOrganizationById(id);
  if (!org) notFound();

  return (
    <AdminWizard
      user={toSafeUser(session.user)}
      organizationId={id}
      organizationName={org.name}
      organizationPublicId={org.organizationId}
    />
  );
}
