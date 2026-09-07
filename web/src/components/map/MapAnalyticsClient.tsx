"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";

export function MapAnalyticsClient({ user }: { user: SafeUser }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch("/api/analytics/map", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setData(d));
  }, []);

  const byArea =
    ((data?.analytics as { byArea?: Array<Record<string, unknown>> })?.byArea as Array<
      Record<string, unknown>
    >) || [];

  return (
    <AdminShell user={user}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Map analytics</h1>
          <p className="text-xs text-muted">Incidents, risk, and health by area — org scoped.</p>
        </div>
        <Link href="/map?mode=RISK" className="rounded border border-white/15 px-3 py-1.5 text-xs">
          Risk map
        </Link>
      </div>
      <div className="overflow-auto rounded-xl border border-border">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-white/5 text-muted">
            <tr>
              <th className="px-3 py-2">Area</th>
              <th className="px-3 py-2">Risk</th>
              <th className="px-3 py-2">Score</th>
              <th className="px-3 py-2">Factors</th>
            </tr>
          </thead>
          <tbody>
            {byArea.map((row) => (
              <tr key={String(row.area)} className="border-b border-white/5">
                <td className="px-3 py-2">{String(row.area)}</td>
                <td className="px-3 py-2">{String(row.risk)}</td>
                <td className="px-3 py-2">{row.score == null ? "—" : String(row.score)}</td>
                <td className="px-3 py-2 text-muted">
                  {((row.factors as string[]) || []).join("; ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!!((data?.campusComparison as unknown[]) || []).length && (
        <section className="mt-6 rounded-xl border border-border p-4 text-xs">
          <h2 className="mb-2 font-semibold">Campus comparison (this organization)</h2>
          <pre className="overflow-auto text-[11px] text-muted">
            {JSON.stringify(data?.campusComparison, null, 2)}
          </pre>
        </section>
      )}
    </AdminShell>
  );
}
