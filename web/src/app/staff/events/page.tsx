import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { EventsClient } from "@/components/monitoring/EventsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Events | Staff | AI Campus Guardian",
  robots: { index: false, follow: false },
};

export default async function StaffEventsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <EventsClient user={toSafeUser(session.user)} portal="staff" />;
}
