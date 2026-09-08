"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { MonitoringPortal } from "./MonitoringPortal";
import { SeverityBadge, formatConfidence, formatDateTime, formatEventType } from "./shared";

interface EventDetail {
  id: string;
  eventId: string;
  eventType: string;
  severity: string;
  confidence: number | null;
  status: string;
  riskScore: number;
  riskLevel: string;
  riskFactors: string[];
  locationLabel: string;
  detectedAt: string;
  source: string;
  metadata: Record<string, unknown>;
  hasSnapshot: boolean;
  relatedAlertId: string | null;
  cameraName?: string;
}

const FEEDBACK_OPTIONS = [
  { value: "CORRECT", label: "Correct" },
  { value: "FALSE_POSITIVE", label: "False Positive" },
  { value: "INCORRECT_EVENT_TYPE", label: "Incorrect Event Type" },
  { value: "INCORRECT_SEVERITY", label: "Incorrect Severity" },
] as const;

export function EventDetailClient({ user, portal, eventId }: { user: SafeUser; portal: "admin" | "staff"; eventId: string }) {
  const base = portal === "admin" ? "/admin" : "/staff";
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedbackType, setFeedbackType] = useState("");
  const [reason, setReason] = useState("");
  const [useful, setUseful] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");

  useEffect(() => {
    fetch(`/api/events/${eventId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.event) {
          setEvent({
            ...data.event,
            relatedAlertId: data.relatedAlert?.id ?? data.event.relatedAlertId ?? null,
          });
        }
      })
      .finally(() => setLoading(false));
  }, [eventId]);

  async function submitFeedback() {
    if (!feedbackType) return;
    setSubmitting(true);
    setFeedbackMsg("");
    try {
      const res = await fetch(`/api/events/${eventId}/feedback`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackType, reason: reason || undefined, useful }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to submit feedback");
      setFeedbackMsg("Feedback recorded. Thank you.");
      setReason("");
      setFeedbackType("");
      setUseful(null);
    } catch (e) {
      setFeedbackMsg(e instanceof Error ? e.message : "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <MonitoringPortal portal={portal} user={user}>
      <Link href={`${base}/events`} className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent">
        <ArrowLeft className="h-4 w-4" /> Back to events
      </Link>

      {loading ? (
        <div className="mt-8 h-64 animate-pulse rounded-2xl bg-glass" />
      ) : !event ? (
        <p className="mt-8 text-red-400">Event not found.</p>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div>
              <p className="font-mono text-xs text-muted">{event.eventId}{event.source === "TEST" ? " · SIMULATED" : ""}</p>
              <h1 className="mt-1 text-2xl font-bold">{formatEventType(event.eventType)}</h1>
            </div>

            {event.hasSnapshot ? (
              <div className="overflow-hidden rounded-xl border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/events/${event.id}/snapshot`} alt="Event snapshot" className="w-full object-cover" />
              </div>
            ) : (
              <p className="rounded-xl border border-border p-4 text-sm text-muted">No snapshot available</p>
            )}

            <div className="rounded-xl border border-border p-4">
              <h2 className="text-sm font-semibold">Metadata</h2>
              <pre className="mt-2 overflow-x-auto text-xs text-muted">{JSON.stringify(event.metadata, null, 2)}</pre>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface/50 p-6">
            <dl className="space-y-3 text-sm">
              <div><dt className="text-muted">Type</dt><dd>{formatEventType(event.eventType)}</dd></div>
              <div><dt className="text-muted">Camera</dt><dd>{event.cameraName ?? "—"}</dd></div>
              <div><dt className="text-muted">Location</dt><dd>{event.locationLabel || "—"}</dd></div>
              <div><dt className="text-muted">Confidence</dt><dd>{formatConfidence(event.confidence)}</dd></div>
              <div><dt className="text-muted">Severity</dt><dd><SeverityBadge severity={event.severity} /></dd></div>
              <div><dt className="text-muted">Risk score</dt><dd>{event.riskScore} / 100 ({event.riskLevel})</dd></div>
              <div><dt className="text-muted">Detection time</dt><dd>{formatDateTime(event.detectedAt)}</dd></div>
              <div><dt className="text-muted">Status</dt><dd>{event.status}</dd></div>
              {event.relatedAlertId && (
                <div>
                  <dt className="text-muted">Related alert</dt>
                  <dd><Link href={`${base}/alerts/${event.relatedAlertId}`} className="text-accent hover:underline">View alert</Link></dd>
                </div>
              )}
            </dl>
            {event.riskFactors?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-muted">Risk factors</p>
                <ul className="mt-1 list-inside list-disc text-xs">{event.riskFactors.map((f) => <li key={f}>{f}</li>)}</ul>
              </div>
            )}

            <div className="mt-6 border-t border-border pt-4">
              <h3 className="text-sm font-semibold">Detection Feedback</h3>
              <p className="mt-1 text-xs text-muted">Was this detection useful?</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setUseful(true)} className={`rounded-lg border px-3 py-1.5 text-xs ${useful === true ? "border-emerald-400/40 text-emerald-400" : "border-border text-muted"}`}>Yes</button>
                <button type="button" onClick={() => setUseful(false)} className={`rounded-lg border px-3 py-1.5 text-xs ${useful === false ? "border-red-400/40 text-red-400" : "border-border text-muted"}`}>No</button>
              </div>
              <select value={feedbackType} onChange={(e) => setFeedbackType(e.target.value)} className="mt-3 w-full rounded-lg border border-border bg-black/20 px-3 py-2 text-xs">
                <option value="">Select feedback type…</option>
                {FEEDBACK_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional reason…" rows={2} className="mt-2 w-full rounded-lg border border-border bg-black/20 px-3 py-2 text-xs" />
              <button type="button" onClick={submitFeedback} disabled={!feedbackType || submitting} className="mt-3 w-full rounded-lg bg-accent/20 py-2 text-xs font-semibold text-accent disabled:opacity-40">
                {submitting ? "Submitting…" : "Submit Feedback"}
              </button>
              {feedbackMsg && <p className="mt-2 text-xs text-muted">{feedbackMsg}</p>}
            </div>
          </div>
        </div>
      )}
    </MonitoringPortal>
  );
}
