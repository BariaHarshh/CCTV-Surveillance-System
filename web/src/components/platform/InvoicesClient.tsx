"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import type { SafeUser } from "@/lib/auth/sanitize-user";

type Invoice = {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  paidAt: string | null;
};

export function InvoicesClient({ user }: { user: SafeUser }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const res = await fetch("/api/billing/invoices", { credentials: "include" });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error ?? "Failed to load invoices.");
      setLoading(false);
      return;
    }
    setInvoices(j.invoices ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminShell user={user}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Invoice History</h1>
          <p className="mt-1 text-sm text-muted">Billing records for your organization</p>
        </div>
        <Link href="/admin/billing" className="text-sm text-accent hover:underline">
          ← Back to billing
        </Link>
      </div>

      {loading ? (
        <Loader2 className="mt-12 h-8 w-8 animate-spin text-accent" />
      ) : error ? (
        <p className="mt-8 text-sm text-red-400">{error}</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Paid</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-white/[0.04]">
                  <td className="px-4 py-3 font-mono">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(inv.periodStart).toLocaleDateString()} – {new Date(inv.periodEnd).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {inv.amount} {inv.currency}
                  </td>
                  <td className="px-4 py-3">{inv.status}</td>
                  <td className="px-4 py-3 text-muted">
                    {inv.paidAt ? new Date(inv.paidAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    No invoices yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
