import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { RoomsClient } from "@/components/admin/RoomsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rooms | Admin | AI Campus Guardian",
  robots: { index: false, follow: false },
};

export default async function AdminRoomsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <RoomsClient user={toSafeUser(session.user)} />;
}
