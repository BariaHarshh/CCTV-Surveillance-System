import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { AlertsClient } from "@/components/monitoring/AlertsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Alert Center | Admin | AI Campus Guardian",
  robots: { index: false, follow: false },
};

export default async function AdminAlertsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <AlertsClient user={toSafeUser(session.user)} portal="admin" />;
}
