import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { TasksClient } from "@/components/mobile/MobileOpsClients";

export default async function Page({ params }: { params: Promise<{ taskId: string }> }) {
  const session = await getAuthSession();
  if (!session) return null;
  const { taskId } = await params;
  return <TasksClient user={toSafeUser(session.user)} taskId={taskId} />;
}
