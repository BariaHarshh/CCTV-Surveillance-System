import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { StaffWizard } from "@/components/admin/StaffWizard";

export default async function NewStaffPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <StaffWizard user={toSafeUser(session.user)} />;
}
