"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  AnalyticsFiltersBar,
  CompositionDonut,
  KpiCard,
  RankBarChart,
  TrendLineChart,
  qs,
} from "@/components/analytics/charts";

type Domain =
  | "incidents"
  | "alerts"
  | "cameras"
  | "ai"
  | "response"
  | "emergencies"
  | "locations"
  | "teams"
  | "data-quality"
  | "risk"
  | "patterns";

const TITLES: Record<Domain, { title: string; subtitle: string }> = {
  incidents: { title: "Incident Analytics", subtitle: "Volume, severity, status, and trends from real incident records." },
  alerts: { title: "Alert Analytics", subtitle: "Alert volume, acknowledgement quality, and fatigue indicators." },
  cameras: { title: "Camera Analytics", subtitle: "Availability and health from live camera status." },
  ai: { title: "AI Performance", subtitle: "Detection volume, feedback quality, and provider health." },
  response: { title: "Response Analytics", subtitle: "Pipeline timings from detection through resolution." },
  emergencies: { title: "Emergency Analytics", subtitle: "Emergency frequency, duration, and escalations." },
  locations: { title: "Location Risk Analysis", subtitle: "Highest-activity buildings, rooms, and cameras from incidents." },
  teams: { title: "Team Performance", subtitle: "Operational task metrics for response teams — for improvement, not punishment." },
  "data-quality": { title: "Data Quality", subtitle: "Completeness and consistency of source operational data." },
  risk: { title: "Risk Analytics", subtitle: "Configured risk posture from incidents and locations." },
  patterns: { title: "Safety Patterns", subtitle: "Recurring clusters detected from historical data — not crime prediction." },
};

function flattenKpis(data: Record<string, unknown>, domain: Domain): Array<{ label: string; value: string | number; href?: string }> {
  if (!data || data.empty) return [];
  if (domain === "incidents") {
    const s = (data.summary as Record<string, number>) ?? data;
    return [
      { label: "Total", value: s.total ?? 0, href: "/admin/incidents" },
      { label: "Critical", value: s.critical ?? 0, href: "/admin/incidents?severity=CRITICAL" },
      { label: "High", value: s.high ?? 0 },
      { label: "Medium", value: s.medium ?? 0 },
      { label: "Low", value: s.low ?? 0 },
      { label: "Open", value: s.open ?? 0, href: "/admin/incidents?status=OPEN" },
      { label: "Investigating", value: s.investigating ?? 0 },
      { label: "Resolved", value: s.resolved ?? 0 },
      { label: "Dismissed", value: s.dismissed ?? 0 },
    ];
  }
  if (domain === "alerts") {
    const s = (data.summary as Record<string, number>) ?? data;
    return [
      { label: "Generated", value: s.total ?? 0, href: "/admin/alerts" },
      { label: "Critical", value: s.critical ?? 0, href: "/admin/alerts?severity=CRITICAL" },
      { label: "High", value: s.high ?? 0 },
      { label: "Medium", value: s.medium ?? 0 },
      { label: "Low", value: s.low ?? 0 },
      { label: "Acknowledged", value: s.acknowledged ?? 0 },
      { label: "Unacknowledged", value: s.unacknowledged ?? 0 },
      { label: "Resolved", value: s.resolved ?? 0 },
      { label: "Dismissed", value: s.dismissed ?? 0 },
    ];
  }
  if (domain === "cameras") {
    return [
      { label: "Total", value: (data.total as number) ?? 0, href: "/admin/cameras" },
      { label: "Online", value: (data.online as number) ?? 0 },
      { label: "Offline", value: (data.offline as number) ?? 0 },
      { label: "Maintenance", value: (data.maintenance as number) ?? 0 },
      { label: "Avg Availability", value: data.averageAvailability != null ? `${data.averageAvailability}%` : "Insufficient data" },
      { label: "Tamper Events", value: (data.tamperEvents as number) ?? 0 },
      { label: "Stream Errors", value: (data.streamErrors as number) ?? 0 },
    ];
  }
  if (domain === "ai") {
    return [
      { label: "Active Models", value: (data.activeModels as number) ?? 0 },
      { label: "Detection Events", value: (data.detectionEvents as number) ?? 0 },
      { label: "True Positive Feedback", value: (data.feedback as Record<string, number>)?.correct ?? 0 },
      { label: "False Positive Feedback", value: (data.feedback as Record<string, number>)?.falsePositive ?? 0 },
      {
        label: "Precision Estimate",
        value: data.precisionEstimate != null ? `${data.precisionEstimate}%` : "Not enough feedback data.",
      },
      {
        label: "Processing Latency",
        value:
          (data.health as { metrics?: { averageDetectionLatencyMs?: number | null } })?.metrics?.averageDetectionLatencyMs !=
          null
            ? `${(data.health as { metrics: { averageDetectionLatencyMs: number } }).metrics.averageDetectionLatencyMs}ms`
            : "Insufficient data",
      },
    ];
  }
  if (domain === "response") {
    const stages = (data.stages as Record<string, { avg?: number | null }>) ?? data;
    const fmt = (ms?: number | null) => (ms != null ? `${Math.round(ms / 1000)}s` : "Insufficient incident history.");
    return [
      { label: "Alert → Ack (avg)", value: fmt((stages.alertToAcknowledgement as { avg?: number })?.avg ?? (data.alertToAcknowledgement as { avg?: number })?.avg) },
      { label: "Median Response", value: fmt((data.medianResponseMs as number) ?? (data.alertToAcknowledgement as { median?: number })?.median) },
      { label: "P95 Response", value: fmt((data.p95ResponseMs as number) ?? (data.alertToAcknowledgement as { p95?: number })?.p95) },
      { label: "Total Duration (avg)", value: fmt((data.totalIncidentDuration as { avg?: number })?.avg) },
    ];
  }
  if (domain === "emergencies") {
    const esc = (data.escalationAnalytics as Record<string, number>) ?? {};
    return [
      { label: "Emergencies", value: (data.total as number) ?? 0, href: "/admin/emergency" },
      { label: "Unresolved", value: (data.unresolved as number) ?? 0 },
      { label: "Resolution Rate", value: data.resolutionRate != null ? `${data.resolutionRate}%` : "—" },
      { label: "Escalations", value: (data.escalations as number) ?? 0 },
      { label: "Avg Duration", value: data.averageDurationMs != null ? `${Math.round((data.averageDurationMs as number) / 60000)}m` : "—" },
      { label: "Level 1", value: esc.level1 ?? 0 },
      { label: "Level 2", value: esc.level2 ?? 0 },
      { label: "Level 3", value: esc.level3 ?? 0 },
      { label: "Level 4", value: esc.level4 ?? 0 },
      { label: "Timeout Rate", value: esc.timeoutRate != null ? `${esc.timeoutRate}%` : "—" },
    ];
  }
  if (domain === "data-quality") {
    const issues = (data.issues as Record<string, number>) ?? {};
    return [
      { label: "Data Quality Score", value: `${data.score ?? "—"} / 100` },
      { label: "Missing Locations", value: issues.missingCameraLocations ?? 0 },
      { label: "No Confidence", value: issues.eventsWithoutConfidence ?? 0 },
      { label: "No Evidence", value: issues.eventsWithoutEvidence ?? 0 },
      { label: "Unresolved Incidents", value: issues.unresolvedIncidents ?? 0 },
      { label: "Missing Response", value: issues.missingResponseData ?? 0 },
    ];
  }
  return Object.entries(data)
    .filter(([, v]) => typeof v === "number" || typeof v === "string")
    .slice(0, 8)
    .map(([k, v]) => ({ label: k, value: v as string | number }));
}

export function AnalyticsDomainClient({
  user,
  domain,
}: {
  user: SafeUser;
  domain: Domain;
}) {
  const meta = TITLES[domain];
  const [filters, setFilters] = useState<Record<string, string>>({ granularity: "day" });
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/analytics/${domain}?${qs(filters)}`, { credentials: "include" });
    const json = await res.json();
    setData((json.data as Record<string, unknown>) ?? json);
    setLoading(false);
  }, [domain, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const payload = (data?.data as Record<string, unknown>) ?? data ?? {};
  const summary =
    domain === "incidents"
      ? ((payload.summary as Record<string, unknown>) ?? payload)
      : domain === "alerts"
        ? ((payload.summary as Record<string, unknown>) ?? payload)
        : payload;
  const kpis = flattenKpis(summary as Record<string, unknown>, domain);
  const empty = Boolean((summary as { empty?: boolean }).empty) || (domain === "incidents" && ((summary as { total?: number }).total ?? 0) === 0 && !loading);

  const trend =
    domain === "incidents"
      ? ((payload.trend as { series?: Array<Record<string, unknown>> })?.series ?? [])
      : domain === "alerts"
        ? ((payload.volume as { perDay?: Array<Record<string, unknown>> })?.perDay ?? []).map((d) => ({
            period: d.date,
            count: d.count,
          }))
        : domain === "emergencies"
          ? ((payload.trend as Array<Record<string, unknown>>) ?? [])
          : [];

  const eventTypes =
    domain === "incidents"
      ? ((payload.eventTypes as { items?: Array<{ eventType: string; count: number }> })?.items ?? []).map((i) => ({
          name: i.eventType.replace(/_/g, " "),
          value: i.count,
        }))
      : [];

  const buildings = domain === "locations" ? ((payload.buildings as Array<Record<string, unknown>>) ?? []) : [];
  const heatmap = domain === "locations" ? ((payload.heatmap as Array<{ building: string; intensity: number }>) ?? []) : [];
  const teams = domain === "teams" ? ((payload.teams as Array<Record<string, unknown>>) ?? []) : [];
  const perCamera = domain === "cameras" ? ((payload.perCamera as Array<Record<string, unknown>>) ?? []) : [];
  const patterns = domain === "patterns" ? ((payload.patterns as Array<Record<string, unknown>>) ?? []) : [];

  return (
    <AdminShell user={user}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/analytics" className="text-[10px] text-accent">← Safety Intelligence</Link>
          <h1 className="mt-1 text-2xl font-bold">{meta.title}</h1>
          <p className="mt-1 text-sm text-muted">{meta.subtitle}</p>
        </div>
        <AnalyticsFiltersBar filters={filters} onChange={setFilters} />
      </div>

      {loading && !data ? (
        <div className="mt-8 grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-glass" />
          ))}
        </div>
      ) : empty && domain !== "data-quality" && domain !== "cameras" ? (
        <p className="mt-10 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
          No data available for this period.
        </p>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((k) => (
              <KpiCard key={k.label} label={k.label} value={k.value} href={k.href} />
            ))}
          </div>

          {domain === "data-quality" && (summary as { warning?: string }).warning && (
            <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              {(summary as { warning: string }).warning}
            </p>
          )}

          {(trend.length > 0 || eventTypes.length > 0) && (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {trend.length > 0 && (
                <section className="rounded-2xl border border-border bg-surface/40 p-5">
                  <h2 className="text-sm font-semibold">Over Time</h2>
                  <div className="mt-3"><TrendLineChart data={trend} /></div>
                </section>
              )}
              {eventTypes.length > 0 && (
                <section className="rounded-2xl border border-border bg-surface/40 p-5">
                  <h2 className="text-sm font-semibold">Type Distribution</h2>
                  <div className="mt-3"><CompositionDonut data={eventTypes} /></div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {eventTypes.map((t) => (
                      <Link
                        key={t.name}
                        href={`/admin/incidents?eventType=${encodeURIComponent(t.name.replace(/ /g, "_").toUpperCase())}`}
                        className="rounded-full border border-border px-2 py-0.5 text-[10px] hover:text-accent"
                      >
                        {t.name} ({t.value})
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {domain === "alerts" && payload.volume && (
            <section className="mt-6 rounded-2xl border border-border bg-surface/40 p-5">
              <h2 className="text-sm font-semibold">Alert Fatigue Analysis</h2>
              <p className="mt-1 text-xs text-muted">Helps identify excessive alert volume so high-value alerts remain visible.</p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-muted">
                    <tr>
                      <th className="py-2">Camera</th>
                      <th>Type</th>
                      <th className="text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {((payload.volume as { repeated?: Array<{ camera: string; type: string; count: number }> }).repeated ?? []).map((r, i) => (
                      <tr key={i} className="border-t border-white/5">
                        <td className="py-2">{r.camera ?? "—"}</td>
                        <td>{r.type}</td>
                        <td className="text-right">{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {((payload.volume as { repeated?: unknown[] }).repeated ?? []).length === 0 && (
                  <p className="text-xs text-muted">No repeated alert clusters in this period.</p>
                )}
              </div>
              <dl className="mt-4 grid gap-2 sm:grid-cols-3 text-xs">
                <div>Ack rate: <strong>{String((summary as { acknowledgementRate?: number }).acknowledgementRate ?? "—")}%</strong></div>
                <div>Resolution: <strong>{String((summary as { resolutionRate?: number }).resolutionRate ?? "—")}%</strong></div>
                <div>Dismissal: <strong>{String((summary as { dismissalRate?: number }).dismissalRate ?? "—")}%</strong></div>
              </dl>
            </section>
          )}

          {domain === "locations" && (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-border bg-surface/40 p-5">
                <h2 className="text-sm font-semibold">Risk Heatmap (by building activity)</h2>
                <div className="mt-4 space-y-2">
                  {heatmap.map((h) => (
                    <div key={h.building} className="flex items-center gap-3 text-xs">
                      <span className="w-28 truncate text-muted">{h.building}</span>
                      <div className="h-3 flex-1 overflow-hidden rounded bg-white/5">
                        <div
                          className="h-full rounded bg-sky-400/70"
                          style={{ width: `${Math.min(100, (h.intensity / Math.max(...heatmap.map((x) => x.intensity), 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="w-8 text-right">{h.intensity}</span>
                    </div>
                  ))}
                  {heatmap.length === 0 && <p className="text-muted">No data available for this period.</p>}
                </div>
                <p className="mt-3 text-[10px] text-muted">Based on incident aggregation — not a prediction that a location is dangerous.</p>
              </section>
              <section className="rounded-2xl border border-border bg-surface/40 p-5">
                <h2 className="text-sm font-semibold">Highest-Risk Buildings</h2>
                <div className="mt-3"><RankBarChart data={buildings.slice(0, 10)} /></div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-muted">
                      <tr>
                        <th className="py-2">Location</th>
                        <th className="text-right">Events</th>
                        <th className="text-right">Critical</th>
                        <th className="text-right">Risk Score</th>
                        <th>Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buildings.map((b) => (
                        <tr key={String(b.location)} className="border-t border-white/5">
                          <td className="py-2">
                            <Link href={`/admin/incidents?building=${encodeURIComponent(String(b.location))}`} className="hover:text-accent">
                              {String(b.location)}
                            </Link>
                          </td>
                          <td className="text-right">{String(b.events)}</td>
                          <td className="text-right">{String(b.critical)}</td>
                          <td className="text-right">{String(b.riskScore)}</td>
                          <td>{String(b.trend)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {domain === "cameras" && (
            <section className="mt-6 rounded-2xl border border-border bg-surface/40 p-5">
              <h2 className="text-sm font-semibold">Camera Availability</h2>
              <p className="mt-1 text-xs text-muted">Historical uptime telemetry is limited — values below are current status snapshots.</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {perCamera.slice(0, 24).map((c) => (
                  <div key={String(c.id)} className="rounded-lg border border-white/5 px-3 py-2 text-xs">
                    <p className="font-medium">{String(c.cameraId)}</p>
                    <p className="text-muted">
                      Availability:{" "}
                      {c.availability != null ? `${c.availability}%` : "Insufficient data"}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {domain === "teams" && (
            <section className="mt-6 overflow-x-auto rounded-2xl border border-border bg-surface/40 p-5">
              <table className="w-full text-left text-xs">
                <thead className="text-muted">
                  <tr>
                    <th className="py-2">Team</th>
                    <th className="text-right">Assigned</th>
                    <th className="text-right">Completed</th>
                    <th className="text-right">Avg Response</th>
                    <th className="text-right">Open</th>
                    <th className="text-right">Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t) => (
                    <tr key={String(t.id)} className="border-t border-white/5">
                      <td className="py-2">{String(t.name)}</td>
                      <td className="text-right">{String(t.assigned)}</td>
                      <td className="text-right">{String(t.completed)}</td>
                      <td className="text-right">
                        {t.avgResponseMs != null ? `${Math.round(Number(t.avgResponseMs) / 1000)}s` : "—"}
                      </td>
                      <td className="text-right">{String(t.open)}</td>
                      <td className="text-right">{t.completionRate != null ? `${t.completionRate}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {teams.length === 0 && <p className="text-muted">No data available for this period.</p>}
              <p className="mt-3 text-[10px] text-muted">Use for operational improvement — not automatic individual punishment.</p>
            </section>
          )}

          {domain === "patterns" && (
            <div className="mt-6 space-y-3">
              {patterns.map((p) => (
                <div key={String(p.patternId ?? p.id)} className="rounded-xl border border-border bg-surface/40 p-4">
                  <h3 className="font-semibold">{String(p.description ?? p.type)}</h3>
                  <p className="mt-1 text-xs text-muted">
                    Observed: {String(p.frequency ?? "—")} · Confidence in pattern detection: {String(p.confidence ?? "—")}
                  </p>
                  <p className="mt-1 text-[10px] text-muted">
                    Confidence refers to the pattern detection calculation, not a forecast that an incident will occur.
                  </p>
                  <Link href="/admin/events" className="mt-2 inline-block text-xs text-accent">View Related Events →</Link>
                </div>
              ))}
              {patterns.length === 0 && (
                <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
                  No recurring patterns detected for this period.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </AdminShell>
  );
}
