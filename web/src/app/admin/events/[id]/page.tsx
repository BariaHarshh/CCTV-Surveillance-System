import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { EventDetailClient } from "@/components/monitoring/EventDetailClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Event Detail | Admin | AI Campus Guardian",
  robots: { index: false, follow: false },
};

export default async function AdminEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  const { id } = await params;
  if (!session) return null;
  return <EventDetailClient user={toSafeUser(session.user)} portal="admin" eventId={id} />;
}
