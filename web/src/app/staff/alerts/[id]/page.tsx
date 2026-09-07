import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { AlertDetailClient } from "@/components/monitoring/AlertDetailClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Alert Detail | Staff | AI Campus Guardian",
  robots: { index: false, follow: false },
};

export default async function StaffAlertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  const { id } = await params;
  if (!session) return null;
  return <AlertDetailClient user={toSafeUser(session.user)} portal="staff" alertId={id} />;
}
