import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { CameraAIClient } from "@/components/admin/CameraAIClient";

export default async function CameraAIPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  const { id } = await params;
  if (!session) return null;
  return <CameraAIClient user={toSafeUser(session.user)} cameraId={id} />;
}
