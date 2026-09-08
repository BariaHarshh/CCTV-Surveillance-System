import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { IncidentsClient } from "@/components/admin/IncidentsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Incidents | Staff | AI Campus Guardian",
  robots: { index: false, follow: false },
};

export default async function StaffIncidentsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <IncidentsClient user={toSafeUser(session.user)} portal="staff" />;
}
