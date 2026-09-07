import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { NotificationsClient } from "@/components/monitoring/NotificationsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notifications | Admin | AI Campus Guardian",
  robots: { index: false, follow: false },
};

export default async function AdminNotificationsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <NotificationsClient user={toSafeUser(session.user)} />;
}
