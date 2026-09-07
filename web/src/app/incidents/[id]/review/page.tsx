import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";
import Link from "next/link";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return null;
  const { id } = await params;
  const user = toSafeUser(session.user);
  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">After Action Review</h1>
      <p className="mt-1 text-sm text-muted">Incident {id}</p>
      <p className="mt-4 text-sm">
        Create a verified after-action review via Governance. Root causes are stored only when explicitly marked
        verified — the system does not invent them.
      </p>
      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link href="/governance" className="text-accent">
          Governance Center
        </Link>
        <Link href={`/admin/incidents/${id}`} className="text-accent">
          Open Incident
        </Link>
        <Link href="/admin/actions" className="text-accent">
          Corrective Actions
        </Link>
      </div>
    </AdminShell>
  );
}
