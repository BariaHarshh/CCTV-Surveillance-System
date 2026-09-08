import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { LiveAIMonitoringClient } from "@/components/monitoring/LiveAIMonitoringClient";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live AI Monitoring | AI Campus Guardian",
  robots: { index: false, follow: false },
};

export default async function DashboardLiveMonitoringPage() {
  const session = await getAuthSession();
  if (!session) {
    redirect("/login");
  }

  const portal = session.user.role === "STAFF" ? "staff" : "admin";
  return <LiveAIMonitoringClient user={toSafeUser(session.user)} portal={portal} />;
}
