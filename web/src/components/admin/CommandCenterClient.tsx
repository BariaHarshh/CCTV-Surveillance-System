"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Brain, Camera, Radio, RefreshCw, Shield, Users, Activity } from "lucide-react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";
import { useMonitoringSocket } from "@/hooks/useMonitoringSocket";
import { cn } from "@/lib/utils";
import { SeverityBadge } from "@/components/monitoring/shared";

interface Overview {
  campusStatus: string;
  cameras: { total: number; online: number; offline: number };
  activeIncidents: Array<Record<string, unknown>>;
  activeEmergencies: Array<Record<string, unknown>>;
  criticalAlerts: number;
  responseTeams: Array<Record<string, unknown>>;
  openTasks: Array<Record<string, unknown>>;
  buildingStatuses: Array<{ id: string; name: string; opsStatus: string; buildingId: string }>;
  escalations: Array<Record<string, unknown>>;
  systemHealth: { overall: string; websocket: string };
  stats: Record<string, number>;
  serverNow: string;
}

const MODE_COLORS: Record<string, string> = {
  NORMAL: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  ELEVATED: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  EMERGENCY: "text-red-400 border-red-500/30 bg-red-500/10",
  LOCKDOWN: "text-orange-400 border-orange-500/30 bg-orange-500/10",
  EVACUATION: "text-rose-400 border-rose-500/30 bg-rose-500/10",
};

const BUILDING_DOT: Record<string, string> = {
  NORMAL: "bg-emerald-400",
  MONITORING: "bg-amber-400",
  AFFECTED: "bg-orange-400",
  EVACUATING: "bg-rose-400",
  RESTRICTED: "bg-violet-400",
  EMERGENCY: "bg-red-500",
};

export function CommandCenterClient({ user }: { user: SafeUser }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ severity: "", emergencyType: "", incidentStatus: "" });

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (filters.severity) qs.set("severity", filters.severity);
    if (filters.emergencyType) qs.set("emergencyType", filters.emergencyType);
    if (filters.incidentStatus) qs.set("incidentStatus", filters.incidentStatus);
    const res = await fetch(`/api/command-center/overview?${qs}`, { credentials: "include" });
    const data = await res.json();
    if (res.ok) setOverview(data.overview);
    setLoading(false);
  }, [filters]);

  useEffect(() => { load(); }, [load]);
  useMonitoringSocket({
    onEmergencyCreated: () => load(),
    onEmergencyUpdated: () => load(),
    onEmergencyResolved: () => load(),
    onIncidentUpdated: () => load(),
    onAlertCreated: () => load(),
    onEscalationTriggered: () => load(),
    onTaskCreated: () => load(),
    onTaskUpdated: () => load(),
  });

  const mode = overview?.campusStatus ?? "NORMAL";

  return (
    <AdminShell user={user}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Campus Command Center</h1>
            <span className={cn("rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider", MODE_COLORS[mode] ?? MODE_COLORS.NORMAL)}>
              ● {mode.replace(/_/g, " ")}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">Real-time safety operations and emergency response.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/emergency" className="rounded-full bg-red-500/15 px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/25">
            Activate Emergency
          </Link>
          <button type="button" onClick={load} className="rounded-full border border-border p-2 text-muted hover:text-foreground">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* AI Command Assistant */}
      <section className="mt-6 rounded-2xl border border-accent/20 bg-accent/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-accent">
              <Brain className="h-4 w-4" /> AI Command Assistant
            </h2>
            <p className="mt-1 text-xs text-muted">Shortcuts to live intelligence — no invented metrics.</p>
          </div>
          <Link href="/ai-copilot" className="rounded-full bg-accent/20 px-3 py-1.5 text-[11px] font-semibold text-accent hover:bg-accent/30">
            Open Copilot
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/ai/daily-briefing" className="rounded-lg border border-border px-3 py-1.5 text-[11px] text-muted hover:text-foreground">Daily Briefing</Link>
          <Link href="/ai/predictive-risk" className="rounded-lg border border-border px-3 py-1.5 text-[11px] text-muted hover:text-foreground">Predictive Risk</Link>
          <Link href="/ai/recommendations" className="rounded-lg border border-border px-3 py-1.5 text-[11px] text-muted hover:text-foreground">Recommendations</Link>
          <Link href="/ai/executive-summary" className="rounded-lg border border-border px-3 py-1.5 text-[11px] text-muted hover:text-foreground">Executive Summary</Link>
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/intelligence/copilot", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: "Give me a dashboard summary of open incidents, critical alerts, and offline cameras" }),
              });
              window.location.href = "/ai-copilot";
            }}
            className="rounded-lg border border-accent/30 px-3 py-1.5 text-[11px] text-accent hover:bg-accent/10"
          >
            Ask: dashboard summary
          </button>
        </div>
      </section>

      {/* Status strip */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        {[
          { label: "Campus Status", value: mode, icon: Shield },
          { label: "Cameras Online", value: overview ? `${overview.cameras.online}/${overview.cameras.total}` : "—", icon: Camera },
          { label: "Active Incidents", value: overview?.stats.activeIncidents ?? "—", icon: AlertTriangle },
          { label: "Critical Alerts", value: overview?.criticalAlerts ?? "—", icon: Radio },
          { label: "Emergency Mode", value: mode !== "NORMAL" ? "ACTIVE" : "OFF", icon: Activity },
          { label: "Response Teams", value: overview?.stats.teamsAvailable ?? "—", icon: Users },
          { label: "System Health", value: overview?.systemHealth.overall ?? "—", icon: Activity },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-surface/60 p-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted">
              <s.icon className="h-3 w-3" /> {s.label}
            </div>
            <p className="mt-1 text-lg font-bold">{String(s.value)}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap gap-2">
        <select value={filters.severity} onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value }))} className="rounded-lg border border-border bg-black/30 px-3 py-1.5 text-xs">
          <option value="">All Severities</option>
          {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.emergencyType} onChange={(e) => setFilters((f) => ({ ...f, emergencyType: e.target.value }))} className="rounded-lg border border-border bg-black/30 px-3 py-1.5 text-xs">
          <option value="">All Types</option>
          {["FIRE", "SECURITY", "MEDICAL", "INTRUSION", "CAMPUS_THREAT"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.incidentStatus} onChange={(e) => setFilters((f) => ({ ...f, incidentStatus: e.target.value }))} className="rounded-lg border border-border bg-black/30 px-3 py-1.5 text-xs">
          <option value="">Incident Status</option>
          {["OPEN", "INVESTIGATING", "CONTAINED"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading && !overview ? (
        <div className="mt-8 h-96 animate-pulse rounded-2xl bg-glass" />
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-12">
          {/* Active Incidents */}
          <section className="rounded-2xl border border-border bg-surface/50 p-4 lg:col-span-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Active Incidents</h2>
            <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {(overview?.activeIncidents ?? []).length === 0 ? (
                <li className="text-xs text-muted">No active incidents</li>
              ) : overview!.activeIncidents.map((inc) => (
                <li key={String(inc.id)}>
                  <Link href={`/admin/incidents/${inc.id}`} className="block rounded-lg border border-border p-3 hover:bg-glass">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug">{String(inc.title)}</p>
                      <SeverityBadge severity={String(inc.severity)} />
                    </div>
                    <p className="mt-1 text-[10px] text-muted">{String(inc.status)} · {String((inc.location as { label?: string })?.label ?? "—")}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* Live Monitoring / Campus Map */}
          <section className="rounded-2xl border border-border bg-surface/50 p-4 lg:col-span-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
                Unified Command Map
              </h2>
              <div className="flex flex-wrap gap-2 text-[10px]">
                <Link href="/map" className="rounded-full border border-sky-500/30 px-2 py-1 text-sky-300 hover:bg-sky-500/10">
                  Live Map
                </Link>
                <Link href="/map?mode=EMERGENCY" className="rounded-full border border-red-500/30 px-2 py-1 text-red-300 hover:bg-red-500/10">
                  Emergency
                </Link>
                <Link href="/map?mode=RISK" className="rounded-full border border-amber-500/30 px-2 py-1 text-amber-300 hover:bg-amber-500/10">
                  Risk
                </Link>
                <Link href="/admin/monitoring" className="text-accent hover:underline">Live Monitoring →</Link>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted">
              Geographic campus map with cameras, incidents, coverage estimates, and emergency layers.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {(overview?.buildingStatuses ?? []).length === 0 ? (
                <p className="text-xs text-muted">No buildings configured</p>
              ) : overview!.buildingStatuses.map((b) => (
                <Link
                  key={b.id}
                  href={`/map?building=${encodeURIComponent(b.buildingId)}`}
                  className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 hover:bg-glass"
                >
                  <span className={cn("h-2.5 w-2.5 rounded-full", BUILDING_DOT[b.opsStatus] ?? "bg-slate-400")} />
                  <div>
                    <p className="text-sm font-medium">{b.name}</p>
                    <p className="text-[10px] text-muted">{b.buildingId} · {b.opsStatus}</p>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              <div className="rounded-lg bg-black/20 p-2"><p className="text-lg font-bold">{overview?.cameras.online ?? 0}</p><p className="text-[10px] text-muted">Cameras Online</p></div>
              <div className="rounded-lg bg-black/20 p-2"><p className="text-lg font-bold">{overview?.openTasks.length ?? 0}</p><p className="text-[10px] text-muted">Open Tasks</p></div>
              <div className="rounded-lg bg-black/20 p-2"><p className="text-lg font-bold">{overview?.escalations.length ?? 0}</p><p className="text-[10px] text-muted">Escalations</p></div>
              <div className="rounded-lg bg-black/20 p-2"><p className="text-lg font-bold">{overview?.activeEmergencies.length ?? 0}</p><p className="text-[10px] text-muted">Emergencies</p></div>
            </div>
          </section>

          {/* Alerts / Emergencies */}
          <section className="rounded-2xl border border-border bg-surface/50 p-4 lg:col-span-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Active Emergencies</h2>
            <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {(overview?.activeEmergencies ?? []).length === 0 ? (
                <li className="text-xs text-muted">No active emergencies</li>
              ) : overview!.activeEmergencies.map((em) => (
                <li key={String(em.id)}>
                  <Link href={`/admin/emergencies/${em.id}`} className="block rounded-lg border border-red-500/20 bg-red-500/5 p-3 hover:bg-red-500/10">
                    <p className="text-sm font-semibold text-red-300">{String(em.type).replace(/_/g, " ")}</p>
                    <p className="mt-0.5 text-xs text-muted">{String(em.reason)}</p>
                    <p className="mt-1 text-[10px] text-muted">{String(em.emergencyId)} · {String(em.status)}</p>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[10px] text-muted">Critical alerts: {overview?.criticalAlerts ?? 0}</p>
          </section>

          {/* Timeline / Tasks */}
          <section className="rounded-2xl border border-border bg-surface/50 p-4 lg:col-span-7">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Open Tasks & Escalations</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <ul className="space-y-2">
                {(overview?.openTasks ?? []).slice(0, 8).map((t) => (
                  <li key={String(t.id)} className="rounded-lg border border-border px-3 py-2 text-xs">
                    <p className="font-medium">{String(t.title)}</p>
                    <p className="text-muted">{String(t.status)} · {String(t.priority)} · {String(t.assignedToName || "Unassigned")}</p>
                  </li>
                ))}
                {(overview?.openTasks ?? []).length === 0 && <li className="text-xs text-muted">No open tasks</li>}
              </ul>
              <ul className="space-y-2">
                {(overview?.escalations ?? []).map((e) => (
                  <li key={String(e.id)} className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs">
                    <p className="font-medium text-amber-300">{String(e.currentLevel)} · {String(e.status)}</p>
                    <p className="text-muted">
                      {e.status === "ACKNOWLEDGED"
                        ? "Escalation Paused"
                        : e.nextEscalationAt
                          ? `Next: ${new Date(String(e.nextEscalationAt)).toLocaleTimeString()}`
                          : "—"}
                    </p>
                    <p className="text-[10px] text-muted">Delivery: {String(e.deliveryStatus)}</p>
                  </li>
                ))}
                {(overview?.escalations ?? []).length === 0 && <li className="text-xs text-muted">No active escalations</li>}
              </ul>
            </div>
          </section>

          {/* Response Teams */}
          <section className="rounded-2xl border border-border bg-surface/50 p-4 lg:col-span-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Response Teams</h2>
              <Link href="/admin/response-teams" className="text-[10px] text-accent hover:underline">Manage →</Link>
            </div>
            <ul className="mt-3 space-y-2">
              {(overview?.responseTeams ?? []).map((t) => (
                <li key={String(t.id)} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{String(t.name)}</p>
                    <p className="text-[10px] text-muted">{String(t.type)} · {String(t.memberCount)} members</p>
                  </div>
                  <span className={cn("text-[10px] font-semibold uppercase", t.status === "AVAILABLE" ? "text-emerald-400" : "text-muted")}>
                    {String(t.status)}
                  </span>
                </li>
              ))}
              {(overview?.responseTeams ?? []).length === 0 && <li className="text-xs text-muted">No teams configured</li>}
            </ul>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
