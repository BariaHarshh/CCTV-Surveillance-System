"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { MonitoringPortal } from "./MonitoringPortal";
import { SeverityBadge, formatConfidence, formatDateTime, formatEventType } from "./shared";

interface AlertDetail {
  id: string;
  alertId: string;
  title: string;
  description: string;
  severity: string;
  riskScore: number;
  status: string;
  location: { campus?: string; building?: string; room?: string; camera?: string };
  assignedToName: string | null;
  acknowledgedByName: string | null;
  acknowledgedAt: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  createdAt: string;
  source: string;
}

interface EventInfo {
  eventId: string;
  eventType: string;
  confidence: number | null;
  detectedAt: string;
  severity: string;
  riskScore: number;
}

export function AlertDetailClient({ user, portal, alertId }: { user: SafeUser; portal: "admin" | "staff"; alertId: string }) {
  const base = portal === "admin" ? "/admin" : "/staff";
  const [alert, setAlert] = useState<AlertDetail | null>(null);
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const load = () => {
    fetch(`/api/alerts/${alertId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.alert) setAlert(data.alert);
        if (data.event) setEvent(data.event);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [alertId]);

  async function updateStatus(status: string) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/alerts/${alertId}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) load();
    } finally {
      setActionLoading(false);
    }
  }

  const timeline = [
    { label: "Detected", at: event?.detectedAt, done: Boolean(event?.detectedAt) },
    { label: "Alert Created", at: alert?.createdAt, done: Boolean(alert?.createdAt) },
    { label: "Acknowledged", at: alert?.acknowledgedAt, done: Boolean(alert?.acknowledgedAt) },
    { label: "Investigation", at: alert?.status === "INVESTIGATING" ? alert.acknowledgedAt : null, done: ["INVESTIGATING", "RESOLVED"].includes(alert?.status ?? "") },
    { label: "Resolved", at: alert?.resolvedAt, done: alert?.status === "RESOLVED" },
  ];

  return (
    <MonitoringPortal portal={portal} user={user}>
      <Link href={`${base}/alerts`} className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent">
        <ArrowLeft className="h-4 w-4" /> Back to alerts
      </Link>

      {loading ? (
        <div className="mt-8 h-64 animate-pulse rounded-2xl bg-glass" />
      ) : !alert ? (
        <p className="mt-8 text-red-400">Alert not found.</p>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            <div>
              <p className="font-mono text-xs text-muted">{alert.alertId}{alert.source === "TEST" ? " · SIMULATED" : ""}</p>
              <h1 className="mt-1 text-2xl font-bold">{alert.title}</h1>
              <p className="mt-2 text-muted">{alert.description}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs uppercase tracking-wider text-muted">Severity</p>
                <div className="mt-2"><SeverityBadge severity={alert.severity} /></div>
              </div>
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs uppercase tracking-wider text-muted">Risk Score</p>
                <p className="mt-2 text-2xl font-bold">{alert.riskScore} <span className="text-sm font-normal text-muted">/ 100</span></p>
              </div>
            </div>

            {event && (
              <div className="rounded-xl border border-border p-4">
                <h2 className="text-sm font-semibold">Event</h2>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div><dt className="text-muted">Type</dt><dd>{formatEventType(event.eventType)}</dd></div>
                  <div><dt className="text-muted">Confidence</dt><dd>{formatConfidence(event.confidence)}</dd></div>
                  <div><dt className="text-muted">Detected At</dt><dd>{formatDateTime(event.detectedAt)}</dd></div>
                </dl>
              </div>
            )}

            <div>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Timeline</h2>
              <div className="space-y-4 border-l border-border pl-6">
                {timeline.map((step) => (
                  <div key={step.label} className="relative">
                    <span className={`absolute -left-[29px] h-3 w-3 rounded-full border-2 ${step.done ? "border-accent bg-accent" : "border-white/20 bg-surface"}`} />
                    <p className="text-sm font-medium">{step.label}</p>
                    {step.at && <p className="text-xs text-muted">{formatDateTime(step.at)}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-surface/50 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Location</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div><dt className="text-muted">Campus</dt><dd>{alert.location.campus ?? "—"}</dd></div>
                <div><dt className="text-muted">Building</dt><dd>{alert.location.building ?? "—"}</dd></div>
                <div><dt className="text-muted">Room</dt><dd>{alert.location.room ?? "—"}</dd></div>
                <div><dt className="text-muted">Camera</dt><dd>{alert.location.camera ?? "—"}</dd></div>
              </dl>
            </div>

            <div className="rounded-2xl border border-border bg-surface/50 p-6">
              <p className="text-xs text-muted">Status: <span className="text-white">{alert.status}</span></p>
              {alert.assignedToName && <p className="mt-2 text-xs text-muted">Assigned: {alert.assignedToName}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {alert.status === "NEW" && (
                  <button type="button" disabled={actionLoading} onClick={() => updateStatus("ACKNOWLEDGED")} className="rounded-lg bg-accent/10 px-3 py-1.5 text-xs text-accent hover:bg-accent/20">Acknowledge</button>
                )}
                {["NEW", "ACKNOWLEDGED"].includes(alert.status) && (
                  <button type="button" disabled={actionLoading} onClick={() => updateStatus("INVESTIGATING")} className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs text-amber-400">Investigate</button>
                )}
                {!["RESOLVED", "DISMISSED"].includes(alert.status) && (
                  <>
                    <button type="button" disabled={actionLoading} onClick={() => updateStatus("RESOLVED")} className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-400">Resolve</button>
                    <button type="button" disabled={actionLoading} onClick={() => updateStatus("DISMISSED")} className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-muted">Dismiss</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </MonitoringPortal>
  );
}
