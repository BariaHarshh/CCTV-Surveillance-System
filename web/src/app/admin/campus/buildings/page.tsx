import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { BuildingsClient } from "@/components/admin/BuildingsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Buildings | Admin | AI Campus Guardian",
  robots: { index: false, follow: false },
};

export default async function AdminBuildingsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <BuildingsClient user={toSafeUser(session.user)} />;
}
