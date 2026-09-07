import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { StaffRoomsClient } from "@/components/staff/StaffRoomsClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Rooms | Staff Portal", robots: { index: false, follow: false } };

export default async function StaffRoomsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <StaffRoomsClient user={toSafeUser(session.user)} />;
}
