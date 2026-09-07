import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  const user = toSafeUser(session.user);
  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Scheduled Reports</h1>
      <p className="mt-2 text-sm text-muted">
        Architecture ready for Daily, Weekly, Monthly, and Quarterly delivery to authorized recipients.
        External email delivery is not enabled until a provider is connected.
      </p>
      <ul className="mt-6 space-y-2 text-sm text-muted">
        <li>• Daily</li>
        <li>• Weekly</li>
        <li>• Monthly</li>
        <li>• Quarterly</li>
      </ul>
      <p className="mt-6 text-xs text-muted">Configure schedules in a future release once notification delivery is connected.</p>
    </AdminShell>
  );
}
