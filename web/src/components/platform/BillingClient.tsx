"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import type { SafeUser } from "@/lib/auth/sanitize-user";

type Overview = {
  organization: string;
  subscription: { planId: string; status: string; trialEndsAt: string | null };
  plan: { name: string; price: number; currency: string; billingInterval: string } | null;
  usage: Record<string, { used: number; max: number }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    amount: number;
    currency: string;
    status: string;
    periodStart: string;
    periodEnd: string;
  }>;
};

type Plan = {
  planId: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  billingInterval: string;
};

export function BillingClient({ user, invoicesOnly }: { user: SafeUser; invoicesOnly?: boolean }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/billing/overview", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/billing/plans", { credentials: "include" }).then((r) => r.json()),
    ]).then(([o, p]) => {
      setOverview(o.overview);
      setPlans(p.plans ?? []);
    });
  }, []);

  async function upgrade(planId: string) {
    setBusy(planId);
    setMessage("");
    const res = await fetch("/api/billing/upgrade", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    const j = await res.json();
    setBusy(null);
    if (!res.ok) {
      setMessage(j.error ?? "Upgrade failed.");
      return;
    }
    setMessage(`Upgraded. Redirect: ${j.checkout?.url ?? "ok"}`);
    const o = await fetch("/api/billing/overview", { credentials: "include" }).then((r) => r.json());
    setOverview(o.overview);
  }

  if (!overview) {
    return (
      <AdminShell user={user}>
        <Loader2 className="mt-12 h-8 w-8 animate-spin text-accent" />
      </AdminShell>
    );
  }

  if (invoicesOnly) {
    return (
      <AdminShell user={user}>
        <h1 className="text-2xl font-bold">Invoices</h1>
        <p className="mt-1 text-muted">{overview.organization}</p>
        <InvoiceTable invoices={overview.invoices} />
      </AdminShell>
    );
  }

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Billing</h1>
      <p className="mt-1 text-muted">
        {overview.organization} · {overview.subscription.planId} ({overview.subscription.status})
      </p>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(overview.usage).map(([key, val]) => (
          <div key={key} className="rounded-2xl border border-border bg-surface/50 p-4">
            <div className="text-xs uppercase text-muted">{key}</div>
            <div className="mt-2 text-2xl font-semibold">
              {val.used}
              <span className="text-sm font-normal text-muted"> / {val.max || "∞"}</span>
            </div>
          </div>
        ))}
      </section>

      <h2 className="mt-10 text-lg font-semibold">Plans</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {plans.map((p) => (
          <div key={p.planId} className="rounded-2xl border border-border bg-surface/50 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{p.name}</h3>
                <p className="mt-1 text-sm text-muted">{p.description}</p>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold">
                  {p.currency} {p.price}
                </div>
                <div className="text-xs text-muted">/{p.billingInterval}</div>
              </div>
            </div>
            <button
              type="button"
              disabled={busy === p.planId || overview.subscription.planId === p.planId}
              onClick={() => upgrade(p.planId)}
              className="mt-4 rounded-xl border border-border px-3 py-1.5 text-sm hover:border-accent/40 disabled:opacity-40"
            >
              {overview.subscription.planId === p.planId
                ? "Current plan"
                : busy === p.planId
                  ? "Working…"
                  : "Upgrade"}
            </button>
          </div>
        ))}
      </div>

      {message && <p className="mt-4 text-sm text-muted">{message}</p>}

      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent invoices</h2>
        <Link href="/admin/billing/invoices" className="text-sm text-accent">
          View all
        </Link>
      </div>
      <InvoiceTable invoices={overview.invoices.slice(0, 5)} />
    </AdminShell>
  );
}

function InvoiceTable({
  invoices,
}: {
  invoices: Overview["invoices"];
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="border-b border-border text-xs uppercase text-muted">
          <tr>
            <th className="px-4 py-3">Invoice</th>
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Period</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id} className="border-b border-white/[0.04]">
              <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
              <td className="px-4 py-3">
                {inv.currency} {inv.amount}
              </td>
              <td className="px-4 py-3">{inv.status}</td>
              <td className="px-4 py-3 text-muted">
                {new Date(inv.periodStart).toLocaleDateString()} –{" "}
                {new Date(inv.periodEnd).toLocaleDateString()}
              </td>
            </tr>
          ))}
          {invoices.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-muted">
                No invoices yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
