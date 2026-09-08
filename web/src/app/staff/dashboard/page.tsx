import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { StaffDashboardClient } from "@/components/staff/StaffDashboardClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staff Dashboard | AI Campus Guardian",
  robots: { index: false, follow: false },
};

export default async function StaffDashboardPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <StaffDashboardClient user={toSafeUser(session.user)} />;
}
