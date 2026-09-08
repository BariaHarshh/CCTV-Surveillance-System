import { Suspense } from "react";
import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { AdminSuccessClient } from "@/components/organizations/AdminSuccessClient";

export default async function AdminSuccessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAuthSession();
  if (!session) return null;
  const { id } = await params;
  return (
    <Suspense>
      <AdminSuccessClient user={toSafeUser(session.user)} organizationId={id} />
    </Suspense>
  );
}
