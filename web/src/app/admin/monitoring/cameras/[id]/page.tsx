import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { MonitoringCameraDetailClient } from "@/components/monitoring/MonitoringCameraDetailClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Camera Detail | Monitoring | AI Campus Guardian",
  robots: { index: false, follow: false },
};

export default async function AdminMonitoringCameraPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  const { id } = await params;
  if (!session) return null;
  return <MonitoringCameraDetailClient user={toSafeUser(session.user)} portal="admin" cameraId={id} />;
}
