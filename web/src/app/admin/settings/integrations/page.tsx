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
      <h1 className="text-2xl font-bold">Integrations</h1>
      <p className="mt-1 text-muted">Connect external systems and webhooks</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link href="/admin/settings/integrations/webhooks" className="rounded-2xl border border-border bg-surface/50 p-5 hover:border-accent/40">
          <div className="font-semibold">Webhooks</div>
          <p className="mt-1 text-sm text-muted">Outbound event deliveries</p>
        </Link>
        <Link href="/admin/integrations/ai" className="rounded-2xl border border-border bg-surface/50 p-5 hover:border-accent/40">
          <div className="font-semibold">AI providers</div>
          <p className="mt-1 text-sm text-muted">Detection and intelligence settings</p>
        </Link>
        <Link href="/admin/settings/api" className="rounded-2xl border border-border bg-surface/50 p-5 hover:border-accent/40">
          <div className="font-semibold">API keys</div>
          <p className="mt-1 text-sm text-muted">Programmatic access</p>
        </Link>
      </div>
    </AdminShell>
  );
}
