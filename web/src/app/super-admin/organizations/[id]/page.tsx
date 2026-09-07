import { Suspense } from "react";
import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { OrganizationProfileClient } from "@/components/organizations/OrganizationProfileClient";

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAuthSession();
  if (!session) return null;
  const { id } = await params;
  return (
    <Suspense>
      <OrganizationProfileClient user={toSafeUser(session.user)} orgId={id} />
    </Suspense>
  );
}
