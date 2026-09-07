import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { CampusOverviewClient } from "@/components/admin/CampusOverviewClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Campus Overview | Admin | AI Campus Guardian",
  robots: { index: false, follow: false },
};

export default async function AdminCampusPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <CampusOverviewClient user={toSafeUser(session.user)} />;
}
