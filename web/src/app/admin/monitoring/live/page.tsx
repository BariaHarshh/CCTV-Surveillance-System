import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { LiveAIMonitoringClient } from "@/components/monitoring/LiveAIMonitoringClient";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live AI Monitoring | Admin | AI Campus Guardian",
  robots: { index: false, follow: false },
};

export default async function AdminLiveMonitoringPage() {
  const session = await getAuthSession();
  if (!session) {
    redirect("/login");
  }

  return <LiveAIMonitoringClient user={toSafeUser(session.user)} portal="admin" />;
}
