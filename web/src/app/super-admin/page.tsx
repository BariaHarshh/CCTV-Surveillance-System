import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { SuperAdminDashboard } from "@/components/super-admin/SuperAdminDashboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Super Admin Dashboard | AI Campus Guardian",
  robots: { index: false, follow: false },
};

export default async function SuperAdminPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <SuperAdminDashboard user={toSafeUser(session.user)} />;
}
