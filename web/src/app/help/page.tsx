import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { HelpClient } from "@/components/platform/HelpClient";
import { redirect } from "next/navigation";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  return <HelpClient user={toSafeUser(session.user)} />;
}
