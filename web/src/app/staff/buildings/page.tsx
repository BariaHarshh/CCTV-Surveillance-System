import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { StaffBuildingsClient } from "@/components/staff/StaffBuildingsClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Buildings | Staff Portal", robots: { index: false, follow: false } };

export default async function StaffBuildingsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <StaffBuildingsClient user={toSafeUser(session.user)} />;
}
