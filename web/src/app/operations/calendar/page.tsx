import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { OperationsCalendarClient } from "@/components/enterprise/EnterpriseClients";

export default async function OperationsCalendarPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <OperationsCalendarClient user={toSafeUser(session.user)} />;
}
