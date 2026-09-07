import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { DepartmentsClient } from "@/components/platform/DepartmentsClient";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  return <DepartmentsClient user={toSafeUser(session.user)} />;
}
