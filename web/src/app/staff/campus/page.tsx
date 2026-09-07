import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { StaffCampusClient } from "@/components/staff/StaffCampusClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Campus | Staff Portal", robots: { index: false, follow: false } };

export default async function StaffCampusPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <StaffCampusClient user={toSafeUser(session.user)} />;
}
