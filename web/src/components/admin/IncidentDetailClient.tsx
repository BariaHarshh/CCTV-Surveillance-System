"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Brain, Loader2 } from "lucide-react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";
import { StaffShell } from "@/components/staff/StaffShell";
import { SeverityBadge } from "@/components/monitoring/shared";

export function IncidentDetailClient({ user, incidentId, portal = "admin" }: { user: SafeUser; incidentId: string; portal?: "admin" | "staff" }) {
  const base = portal === "admin" ? "/admin" : "/staff";
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<Record<string, unknown> | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const load = () => {
    fetch(`/api/admin/incidents/${incidentId}`, { credentials: "include" })
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [incidentId]);

  const incident = data?.incident as Record<string, unknown> | undefined;
  const events = (data?.events as Record<string, unknown>[]) ?? [];
  const alerts = (data?.alerts as Record<string, unknown>[]) ?? [];

  async function updateStatus(status: string) {
    await fetch(`/api/admin/incidents/${incidentId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  const Shell = portal === "admin" ? AdminShell : StaffShell;

  return (
    <Shell user={user}>
      <Link href={`${base}/incidents`} className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent">
        <ArrowLeft className="h-4 w-4" /> Back to incidents
      </Link>

      {loading ? (
        <div className="mt-8 h-64 animate-pulse rounded-2xl bg-glass" />
      ) : !incident ? (
        <p className="mt-8 text-red-400">Incident not found.</p>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div>
              <p className="font-mono text-xs text-muted">{String(incident.incidentId)}</p>
              <h1 className="text-2xl font-bold">{String(incident.title)}</h1>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs text-muted">Severity</p>
                <div className="mt-2"><SeverityBadge severity={String(incident.severity)} /></div>
              </div>
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs text-muted">Risk Score</p>
                <p className="mt-2 text-2xl font-bold">{String(incident.riskScore)} / 100</p>
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Timeline</h2>
              <div className="space-y-2">
                {events.map((e) => (
                  <div key={String(e.id)} className="rounded-xl border border-border px-4 py-3">
                    <p className="text-xs text-muted">{new Date(String(e.detectedAt)).toLocaleString()}</p>
                    <p className="text-sm font-medium">{String(e.eventType).replace(/_/g, " ")}</p>
                  </div>
                ))}
              </div>
            </div>

            {alerts.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Related Alerts</h2>
                {alerts.map((a) => (
                  <Link key={String(a.id)} href={`${base}/alerts/${a.id}`} className="block rounded-xl border border-border px-4 py-3 hover:bg-glass">
                    <p className="text-sm">{String(a.title)}</p>
                    <p className="text-xs text-muted">{String(a.status)}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface/50 p-6">
            <p className="text-xs text-muted">Status: {String(incident.status)}</p>
            <p className="mt-2 text-xs text-muted">Location: {String((incident.location as Record<string, string>)?.label ?? "—")}</p>
            {incident.assignedToName ? <p className="mt-2 text-xs">Assigned: {String(incident.assignedToName)}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {incident.status === "OPEN" && (
                <button type="button" onClick={() => updateStatus("INVESTIGATING")} className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs text-amber-400">Investigate</button>
              )}
              {!["RESOLVED", "DISMISSED"].includes(String(incident.status)) && (
                <>
                  <button type="button" onClick={() => updateStatus("CONTAINED")} className="rounded-lg bg-orange-500/10 px-3 py-1.5 text-xs text-orange-400">Contain</button>
                  <button type="button" onClick={() => updateStatus("RESOLVED")} className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-400">Resolve</button>
                  <button type="button" onClick={() => updateStatus("DISMISSED")} className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-muted">Dismiss</button>
                </>
              )}
              {!incident.emergencyId && !["RESOLVED", "DISMISSED"].includes(String(incident.status)) && (
                <button
                  type="button"
                  onClick={async () => {
                    const reason = window.prompt("Escalation reason?");
                    if (!reason || reason.length < 3) return;
                    await fetch(`/api/admin/incidents/${incidentId}`, {
                      method: "PATCH",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        escalate: { type: "SECURITY", reason, confirm: true },
                      }),
                    });
                    load();
                  }}
                  className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs text-red-300"
                >
                  Escalate to Emergency
                </button>
              )}
              <Link href={`/admin/incidents/${incidentId}/tasks`} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground">
                Tasks
              </Link>
              <Link
                href={`/map?incident=${encodeURIComponent(String(incident.incidentId || incidentId))}&mode=INCIDENT`}
                className="rounded-lg border border-sky-500/30 px-3 py-1.5 text-xs text-sky-300 hover:bg-sky-500/10"
              >
                View on Map
              </Link>
              {incident.emergencyId ? (
                <Link
                  href={`/emergency/${encodeURIComponent(String(incident.emergencyId))}/map`}
                  className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                >
                  Emergency Map
                </Link>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-accent/20 bg-accent/5 p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-accent">
                <Brain className="h-4 w-4" /> AI Summary
              </h2>
              <button
                type="button"
                disabled={aiLoading}
                onClick={async () => {
                  setAiLoading(true);
                  setAiError(null);
                  try {
                    const res = await fetch(`/api/intelligence/incidents/${incidentId}/summary`, { credentials: "include" });
                    const json = await res.json();
                    if (!res.ok) setAiError(json.error ?? "Failed to load summary");
                    else setAiSummary(json.summary);
                  } finally {
                    setAiLoading(false);
                  }
                }}
                className="rounded-lg bg-accent/20 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/30 disabled:opacity-50"
              >
                {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "[AI Summary]"}
              </button>
            </div>
            {aiError && <p className="mt-3 text-xs text-red-400">{aiError}</p>}
            {aiSummary && (
              <div className="mt-3 space-y-2 text-xs">
                <p className="font-medium">{String(aiSummary.title)}</p>
                <p className="text-muted">{String(aiSummary.note)}</p>
                <ul className="list-disc space-y-1 pl-4">
                  {((aiSummary.confirmedFacts as string[]) ?? []).map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                {((aiSummary.timeline as Array<{ at: string; label: string }>) ?? []).length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-border pt-2">
                    {((aiSummary.timeline as Array<{ at: string; label: string }>) ?? []).map((t) => (
                      <p key={t.at + t.label} className="text-muted">
                        {new Date(t.at).toLocaleString()} — {t.label}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
