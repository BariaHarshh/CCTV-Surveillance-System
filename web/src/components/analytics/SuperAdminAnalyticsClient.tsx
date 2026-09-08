"use client";

import { useEffect, useState } from "react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";
import { KpiCard } from "@/components/analytics/charts";

export function SuperAdminAnalyticsClient({ user }: { user: SafeUser }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch("/api/super-admin/analytics", { credentials: "include" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  const platform = (data?.platform as Record<string, number>) ?? {};
  const health = (data?.health as Record<string, string>) ?? {};
  const comparison = (data?.comparison as Array<Record<string, unknown>>) ?? [];

  return (
    <SuperAdminShell user={user}>
      <div>
        <h1 className="text-2xl font-bold">Platform Intelligence</h1>
        <p className="mt-1 text-muted">Aggregated operational metrics across organizations — without sensitive incident detail.</p>
      </div>

      {!data ? (
        <div className="mt-8 grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-glass" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Total Organizations" value={platform.organizationsTotal ?? 0} />
            <KpiCard label="Active Organizations" value={platform.organizationsActive ?? 0} />
            <KpiCard label="Total Cameras" value={platform.camerasTotal ?? 0} />
            <KpiCard label="Online Cameras" value={platform.camerasOnline ?? 0} />
            <KpiCard label="Total Events" value={platform.eventsTotal ?? 0} />
            <KpiCard label="Total Alerts" value={platform.alertsTotal ?? 0} />
            <KpiCard label="Active Emergencies" value={platform.activeEmergencies ?? 0} />
            <KpiCard label="Platform Health" value={String(health.overall ?? "—")} />
          </div>

          <section className="mt-6 rounded-2xl border border-border bg-surface/40 p-5">
            <h2 className="text-sm font-semibold">Platform Health</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
              {Object.entries(health).map(([k, v]) => (
                <div key={k} className="rounded-lg border border-white/5 px-3 py-2">
                  <dt className="text-[10px] uppercase text-muted">{k}</dt>
                  <dd className="mt-1 font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-6 overflow-x-auto rounded-2xl border border-border bg-surface/40 p-5">
            <h2 className="text-sm font-semibold">Organization Comparison</h2>
            <table className="mt-4 w-full text-left text-xs">
              <thead className="text-muted">
                <tr>
                  <th className="py-2">Organization</th>
                  <th className="text-right">Cameras</th>
                  <th className="text-right">Events</th>
                  <th className="text-right">Alerts</th>
                  <th className="text-right">Availability</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={String(row.organization)} className="border-t border-white/5">
                    <td className="py-2">{String(row.organization)}</td>
                    <td className="text-right">{String(row.cameras)}</td>
                    <td className="text-right">{String(row.events)}</td>
                    <td className="text-right">{String(row.alerts)}</td>
                    <td className="text-right">{row.availability != null ? `${row.availability}%` : "—"}</td>
                    <td>{row.active ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {comparison.length === 0 && <p className="mt-4 text-xs text-muted">No organizations to compare.</p>}
          </section>
        </>
      )}
    </SuperAdminShell>
  );
}
