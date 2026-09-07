import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";
import Link from "next/link";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) return null;
  return (
    <AdminShell user={toSafeUser(session.user)}>
      <h1 className="text-2xl font-bold">AI integrations</h1>
      <p className="mt-1 text-muted">Configure detection providers and camera AI</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link href="/admin/settings/ai" className="rounded-2xl border border-border bg-surface/50 p-5 hover:border-accent/40">
          <div className="font-semibold">AI settings</div>
          <p className="mt-1 text-sm text-muted">Providers, modules, and defaults</p>
        </Link>
        <Link href="/admin/ai" className="rounded-2xl border border-border bg-surface/50 p-5 hover:border-accent/40">
          <div className="font-semibold">AI intelligence</div>
          <p className="mt-1 text-sm text-muted">Overview of AI capabilities</p>
        </Link>
        <Link href="/admin/ai/health" className="rounded-2xl border border-border bg-surface/50 p-5 hover:border-accent/40">
          <div className="font-semibold">AI health</div>
          <p className="mt-1 text-sm text-muted">Provider connectivity status</p>
        </Link>
      </div>
    </AdminShell>
  );
}
