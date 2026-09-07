import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { StaffProfileClient } from "@/components/staff/StaffProfileClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Profile | Staff Portal", robots: { index: false, follow: false } };

export default async function StaffProfilePage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <StaffProfileClient user={toSafeUser(session.user)} />;
}
