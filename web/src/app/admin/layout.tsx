import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/session";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await ensureDbReady();
  const session = await getAuthSession();
  if (!session) redirect("/login?redirect=/admin/dashboard&reason=session_required");
  if (session.user.role !== "ADMIN") redirect("/forbidden");
  if (session.user.mustChangePassword) redirect("/change-password");
  return <AdminShell user={toSafeUser(session.user)}>{children}</AdminShell>;
}
