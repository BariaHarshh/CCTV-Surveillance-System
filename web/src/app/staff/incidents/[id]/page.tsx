import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { IncidentDetailClient } from "@/components/admin/IncidentDetailClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Incident Detail | Staff | AI Campus Guardian",
  robots: { index: false, follow: false },
};

export default async function StaffIncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  const { id } = await params;
  if (!session) return null;
  return <IncidentDetailClient user={toSafeUser(session.user)} incidentId={id} portal="staff" />;
}
