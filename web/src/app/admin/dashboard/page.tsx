import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Dashboard | AI Campus Guardian",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <AdminDashboard user={toSafeUser(session.user)} />;
}
