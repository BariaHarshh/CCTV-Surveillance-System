import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { StaffCamerasClient } from "@/components/staff/StaffCamerasClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Cameras | Staff Portal", robots: { index: false, follow: false } };

export default async function StaffCamerasPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <StaffCamerasClient user={toSafeUser(session.user)} />;
}
