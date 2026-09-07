import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { BillingClient } from "@/components/platform/BillingClient";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  return <BillingClient user={toSafeUser(session.user)} />;
}
