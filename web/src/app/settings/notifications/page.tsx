import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { NotificationPrefsClient } from "@/components/platform/AccountClients";
import { redirect } from "next/navigation";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  return <NotificationPrefsClient user={toSafeUser(session.user)} />;
}
