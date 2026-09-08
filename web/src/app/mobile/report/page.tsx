import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { MobileReportClient } from "@/components/mobile/MobileHomeClient";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  return <MobileReportClient user={toSafeUser(session.user)} />;
}
