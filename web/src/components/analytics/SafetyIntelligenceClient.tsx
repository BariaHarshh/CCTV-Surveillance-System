"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";
import { AnalyticsFiltersBar, CompositionDonut, KpiCard, RankBarChart, TrendLineChart, qs } from "@/components/analytics/charts";

export function SafetyIntelligenceClient({ user }: { user: SafeUser }) {
  const [filters, setFilters] = useState<Record<string, string>>({ granularity: "day" });
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [trend, setTrend] = useState<Array<Record<string, unknown>>>([]);
  const [eventTypes, setEventTypes] = useState<Array<{ name: string; value: number }>>([]);
  const [locations, setLocations] = useState<Array<Record<string, unknown>>>([]);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const q = qs(filters);
    const [ov, inc, loc] = await Promise.all([
      fetch(`/api/analytics/overview?${q}`, { credentials: "include" }).then((r) => r.json()),
      fetch(`/api/analytics/incidents?${q}`, { credentials: "include" }).then((r) => r.json()),
      fetch(`/api/analytics/locations?${q}`, { credentials: "include" }).then((r) => r.json()),
    ]);
    if (ov.overview) setOverview(ov.overview);
    setTrend(inc.data?.trend?.series ?? []);
    setEventTypes((inc.data?.eventTypes?.items ?? []).map((i: { eventType: string; count: number }) => ({
      name: i.eventType.replace(/_/g, " "),
      value: i.count,
    })));
    setLocations(loc.data?.buildings ?? []);
    setLoading(false);
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const score = overview?.safetyScore as Record<string, unknown> | undefined;
  const incidents = overview?.incidents as Record<string, number> | undefined;
  const alerts = overview?.alerts as Record<string, number> | undefined;
  const cameras = overview?.cameras as Record<string, number> | undefined;
  const comparison = overview?.comparison as { incidents?: { changePercent?: number; trend?: string } } | undefined;

  return (
    <AdminShell user={user}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Safety Intelligence</h1>
          <p className="mt-1 text-muted">Understand campus safety performance, trends, risks, and response effectiveness.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link href="/admin/executive" className="rounded-full border border-border px-3 py-1.5 hover:text-accent">Executive</Link>
          <Link href="/admin/reports" className="rounded-full border border-border px-3 py-1.5 hover:text-accent">Reports</Link>
          <Link href="/admin/insights" className="rounded-full border border-border px-3 py-1.5 hover:text-accent">Insights</Link>
          <Link href="/admin/actions" className="rounded-full border border-border px-3 py-1.5 hover:text-accent">Actions</Link>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <AnalyticsFiltersBar filters={filters} onChange={setFilters} />
        <button
          type="button"
          className="rounded-lg border border-border px-3 py-1.5 text-xs hover:text-accent"
          onClick={async () => {
            const name = window.prompt("Saved view name", "My Security Overview");
            if (!name) return;
            await fetch("/api/analytics/saved-views", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name, dashboard: "analytics", filters }),
            });
          }}
        >
          Save View
        </button>
      </div>

      {loading && !overview ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-glass" />)}</div>
      ) : overview?.empty ? (
        <p className="mt-10 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">No data available for this period.</p>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <button type="button" onClick={() => setScoreOpen(true)} className="text-left">
              <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted">Configured Safety Performance Score</p>
                <p className="mt-1 text-3xl font-bold text-accent">{String(score?.overall ?? "—")}<span className="text-base text-muted"> / 100</span></p>
                <p className="mt-1 text-xs text-muted">{String(score?.level ?? "").replace(/_/g, " ")}</p>
              </div>
            </button>
            <KpiCard label="Incidents" value={incidents?.total ?? 0} href={`/admin/analytics/incidents?${qs(filters)}`} hint={comparison?.incidents?.changePercent != null ? `${comparison.incidents.changePercent > 0 ? "+" : ""}${comparison.incidents.changePercent}% vs prior` : undefined} />
            <KpiCard label="Critical Alerts" value={alerts?.critical ?? 0} href={`/admin/analytics/alerts?${qs(filters)}`} />
            <KpiCard label="Camera Availability" value={cameras?.averageAvailability != null ? `${cameras.averageAvailability}%` : "—"} href="/admin/analytics/cameras" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-surface/40 p-5">
              <h2 className="text-sm font-semibold">Incidents Over Time</h2>
              <div className="mt-3"><TrendLineChart data={trend} /></div>
            </section>
            <section className="rounded-2xl border border-border bg-surface/40 p-5">
              <h2 className="text-sm font-semibold">Event Type Distribution</h2>
              <div className="mt-3"><CompositionDonut data={eventTypes} /></div>
            </section>
            <section className="rounded-2xl border border-border bg-surface/40 p-5 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Highest-Risk Buildings</h2>
                <Link href="/admin/analytics/locations" className="text-[10px] text-accent">View all →</Link>
              </div>
              <div className="mt-3"><RankBarChart data={locations.slice(0, 8)} /></div>
              <p className="mt-2 text-[10px] text-muted">Risk is average configured incident risk — not a prediction of danger.</p>
            </section>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            {[
              ["/admin/analytics/incidents", "Incidents"],
              ["/admin/analytics/alerts", "Alerts"],
              ["/admin/analytics/cameras", "Cameras"],
              ["/admin/analytics/ai", "AI"],
              ["/admin/analytics/response", "Response"],
              ["/admin/analytics/emergencies", "Emergencies"],
              ["/admin/analytics/locations", "Locations"],
              ["/admin/analytics/teams", "Teams"],
              ["/admin/analytics/patterns", "Patterns"],
              ["/admin/analytics/data-quality", "Data Quality"],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="rounded-lg border border-border px-3 py-1.5 hover:bg-glass">{label}</Link>
            ))}
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
