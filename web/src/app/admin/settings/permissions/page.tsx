import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";
import Link from "next/link";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  const user = toSafeUser(session.user);
  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Permissions</h1>
      <p className="mt-1 text-muted">Roles, staff access, and invitations</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link href="/admin/staff" className="rounded-2xl border border-border bg-surface/50 p-5 hover:border-accent/40">
          <div className="font-semibold">Staff accounts</div>
          <p className="mt-1 text-sm text-muted">Manage staff permissions</p>
        </Link>
        <Link href="/admin/users/invitations" className="rounded-2xl border border-border bg-surface/50 p-5 hover:border-accent/40">
          <div className="font-semibold">Invitations</div>
          <p className="mt-1 text-sm text-muted">Invite admins and staff</p>
        </Link>
        <Link href="/admin/departments" className="rounded-2xl border border-border bg-surface/50 p-5 hover:border-accent/40">
          <div className="font-semibold">Departments</div>
          <p className="mt-1 text-sm text-muted">Organize by department</p>
        </Link>
      </div>
      <p className="mt-6 text-sm text-muted">Your permissions: {(user.permissions ?? []).join(", ") || "—"}</p>
    </AdminShell>
  );
}
