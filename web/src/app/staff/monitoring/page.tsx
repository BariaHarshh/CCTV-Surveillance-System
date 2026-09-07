import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { MonitoringClient } from "@/components/monitoring/MonitoringClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Monitoring | Staff | AI Campus Guardian",
  robots: { index: false, follow: false },
};

export default async function StaffMonitoringPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <MonitoringClient user={toSafeUser(session.user)} portal="staff" />;
}
