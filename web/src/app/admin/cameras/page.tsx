import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { CamerasClient } from "@/components/admin/CamerasClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cameras | Admin | AI Campus Guardian",
  robots: { index: false, follow: false },
};

export default async function AdminCamerasPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <CamerasClient user={toSafeUser(session.user)} />;
}
