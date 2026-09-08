import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { MfaClient } from "@/components/platform/MfaClient";
import { redirect } from "next/navigation";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  const role = session.user.role;
  const bare = role === "SUPER_ADMIN" || role === "STAFF";
  return <MfaClient user={toSafeUser(session.user)} bare={bare} />;
}
