import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { StaffListClient } from "@/components/admin/StaffListClient";

export default async function AdminStaffPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <StaffListClient user={toSafeUser(session.user)} />;
}
