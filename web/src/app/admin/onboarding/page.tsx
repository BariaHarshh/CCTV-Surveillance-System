import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { OnboardingClient } from "@/components/platform/OnboardingClient";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  return <OnboardingClient user={toSafeUser(session.user)} />;
}
