import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";
import Link from "next/link";

export default async function AdministratorsPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return (
    <SuperAdminShell user={toSafeUser(session.user)}>
      <h1 className="text-2xl font-bold">Platform Administrators</h1>
      <p className="mt-2 max-w-xl text-muted">
        Administrators are created per organization. Open an organization profile to view its admins or create a new administrator account.
      </p>
      <Link
        href="/super-admin/organizations"
        className="mt-6 inline-flex rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-background"
      >
        Go to Organizations
      </Link>
    </SuperAdminShell>
  );
}
