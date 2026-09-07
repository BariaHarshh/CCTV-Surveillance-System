"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";
import { AnalyticsFiltersBar, KpiCard, qs } from "@/components/analytics/charts";

export function ExecutiveDashboardClient({ user }: { user: SafeUser }) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/executive/overview?${qs(filters)}`, { credentials: "include" });
    const json = await res.json();
    setOverview(json.overview ?? null);
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = overview?.summary as Record<string, string> | undefined;
  const score = overview?.safetyScore as Record<string, unknown> | undefined;
  const insights = (overview?.majorInsights as Array<Record<string, unknown>>) ?? [];
  const risks = (overview?.topRiskAreas as Array<Record<string, unknown>>) ?? [];

  return (
    <AdminShell user={user}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Executive Safety Overview</h1>
          <p className="mt-1 text-muted">Leadership view of risk posture, trends, and response — without raw event noise.</p>
        </div>
        <div className="flex gap-2 text-xs">
          <Link href="/admin/analytics" className="rounded-full border border-border px-3 py-1.5 hover:text-accent">Full Analytics</Link>
          <Link href="/admin/reports" className="rounded-full border border-border px-3 py-1.5 hover:text-accent">Reports</Link>
        </div>
      </div>

      <div className="mt-6"><AnalyticsFiltersBar filters={filters} onChange={setFilters} /></div>

      {loading && !overview ? (
        <div className="mt-8 h-40 animate-pulse rounded-2xl bg-glass" />
      ) : overview?.empty ? (
        <p className="mt-10 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
          No data available for this period.
        </p>
      ) : (
        <>
          <section className="mt-6 rounded-2xl border border-accent/20 bg-accent/5 p-6">
            <h2 className="text-sm font-semibold tracking-wide text-accent">Safety Executive Summary</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
              <div>
                <dt className="text-xs text-muted">Overall Performance</dt>
                <dd className="mt-1 text-lg font-bold">{summary?.overallPerformance ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Key Change</dt>
                <dd className="mt-1">
                  <Link href="/admin/analytics/incidents" className="hover:text-accent">{summary?.keyChange ?? "—"}</Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Primary Risk Area</dt>
                <dd className="mt-1">
                  <Link href="/admin/analytics/locations" className="hover:text-accent">{summary?.primaryRiskArea ?? "—"}</Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Response</dt>
                <dd className="mt-1">
                  <Link href="/admin/analytics/response" className="hover:text-accent">{summary?.response ?? "—"}</Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">System</dt>
                <dd className="mt-1">
                  <Link href="/admin/analytics/cameras" className="hover:text-accent">{summary?.system ?? "—"}</Link>
                </dd>
              </div>
            </dl>
          </section>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <button type="button" onClick={() => setScoreOpen(true)} className="text-left">
              <div className="rounded-xl border border-border bg-surface/50 p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted">Configured Safety Performance Score</p>
                <p className="mt-1 text-2xl font-bold">{String(score?.overall ?? "—")} / 100</p>
              </div>
            </button>
            <KpiCard label="Active Incidents" value={Number(overview?.activeIncidents ?? 0)} href="/admin/incidents" />
            <KpiCard label="Critical Alerts" value={Number(overview?.criticalAlerts ?? 0)} href="/admin/alerts?severity=CRITICAL" />
            <KpiCard label="Open Emergencies" value={Number(overview?.openEmergencies ?? 0)} href="/admin/emergency" />
            <KpiCard
              label="Avg Response Time"
              value={
                overview?.averageResponseMs != null
                  ? `${Math.round(Number(overview.averageResponseMs) / 1000)}s`
                  : "Insufficient incident history."
              }
              href="/admin/analytics/response"
            />
            <KpiCard
              label="Resolution Rate"
              value={overview?.resolutionRate != null ? `${overview.resolutionRate}%` : "—"}
              href="/admin/analytics/alerts"
            />
            <KpiCard
              label="Camera Availability"
              value={overview?.cameraAvailability != null ? `${overview.cameraAvailability}%` : "—"}
              href="/admin/analytics/cameras"
            />
            <KpiCard label="AI Detection Health" value="View components" href="/admin/analytics/ai" hint="From configured health metrics" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-surface/40 p-5">
              <h2 className="text-sm font-semibold">Where are the major risks?</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {risks.map((r) => (
                  <li key={String(r.location)} className="flex justify-between border-b border-white/5 py-2">
                    <Link href="/admin/analytics/locations" className="hover:text-accent">{String(r.location)}</Link>
                    <span className="text-muted">{String(r.events)} incidents · risk {String(r.riskScore)}</span>
                  </li>
                ))}
                {risks.length === 0 && <li className="text-muted text-xs">No data available for this period.</li>}
              </ul>
            </section>
            <section className="rounded-2xl border border-border bg-surface/40 p-5">
              <h2 className="text-sm font-semibold">Major Insights</h2>
              <ul className="mt-3 space-y-3 text-sm">
                {insights.map((ins, i) => (
                  <li key={i} className="rounded-lg border border-white/5 p-3">
                    <p className="font-medium">{String(ins.title)}</p>
                    <p className="mt-1 text-xs text-muted">{((ins.evidence as string[]) ?? []).join(" · ")}</p>
                    {ins.change != null && <p className="mt-1 text-xs text-accent">Change: {String(ins.change)}</p>}
                  </li>
                ))}
                {insights.length === 0 && <li className="text-muted text-xs">No verified insights for this period.</li>}
              </ul>
            </section>
          </div>
        </>
      )}

      {scoreOpen && score && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setScoreOpen(false)}>
          <div className="max-w-md rounded-2xl border border-border bg-surface p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Safety Performance</h3>
            <p className="mt-1 text-xs text-muted">{String(score.disclaimer)}</p>
            <p className="mt-4 text-3xl font-bold">Overall: {String(score.overall)} / 100</p>
            <dl className="mt-4 space-y-2 text-sm">
              {Object.entries((score.components as Record<string, number>) ?? {}).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-white/5 py-1">
                  <dt className="text-muted capitalize">{k.replace(/([A-Z])/g, " $1")}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs font-semibold">Why the score changed</p>
            <ul className="mt-1 list-inside list-disc text-xs text-muted">
              {((score.factors as string[]) ?? []).map((f) => <li key={f}>{f}</li>)}
            </ul>
            <button type="button" onClick={() => setScoreOpen(false)} className="mt-4 w-full rounded-lg border border-border py-2 text-xs">Close</button>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
