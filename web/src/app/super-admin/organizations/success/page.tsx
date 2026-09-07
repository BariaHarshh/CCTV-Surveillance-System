import { Suspense } from "react";
import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { OrganizationSuccessClient } from "@/components/organizations/OrganizationSuccessClient";

export default async function OrganizationSuccessPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return (
    <Suspense>
      <OrganizationSuccessClient user={toSafeUser(session.user)} />
    </Suspense>
  );
}
