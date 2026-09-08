import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { StaffShell } from "@/components/staff/StaffShell";
import Link from "next/link";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  const user = toSafeUser(session.user);
  return (
    <StaffShell user={user}>
      <h1 className="text-2xl font-bold">Operational Analytics</h1>
      <p className="mt-1 text-sm text-muted">
        Limited operational metrics for authorized staff. Avoids individual surveillance profiles.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href="/staff/alerts" className="rounded-xl border border-border bg-surface/40 p-4 hover:border-accent/30">
          <p className="font-medium">Assigned Alerts</p>
          <p className="mt-1 text-xs text-muted">Open your alert workspace</p>
        </Link>
        <Link href="/staff/incidents" className="rounded-xl border border-border bg-surface/40 p-4 hover:border-accent/30">
          <p className="font-medium">Incidents</p>
          <p className="mt-1 text-xs text-muted">Incident participation view</p>
        </Link>
        <Link href="/staff/reports" className="rounded-xl border border-border bg-surface/40 p-4 hover:border-accent/30">
          <p className="font-medium">Authorized Reports</p>
          <p className="mt-1 text-xs text-muted">Reports you are permitted to view</p>
        </Link>
      </div>
    </StaffShell>
  );
}
