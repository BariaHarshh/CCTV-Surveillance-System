import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { TrainingClient } from "@/components/enterprise/EnterpriseClients";

export default async function AdminTrainingPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <TrainingClient user={toSafeUser(session.user)} />;
}
