import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { StaffSecurityClient } from "@/components/staff/StaffSecurityClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Security | Staff Portal", robots: { index: false, follow: false } };

export default async function StaffSecurityPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <StaffSecurityClient user={toSafeUser(session.user)} />;
}
