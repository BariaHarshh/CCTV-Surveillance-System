"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";

function formatDuration(ms: number | null) {
  if (ms == null) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function EmergencyReportClient({ user, emergencyId }: { user: SafeUser; emergencyId: string }) {
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetch(`/api/emergencies/${emergencyId}/report`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setReport(d.report);
        setNotes(String(d.report?.emergency?.notes ?? ""));
      });
  }, [emergencyId]);

  async function saveNotes() {
    await fetch(`/api/emergencies/${emergencyId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
  }

  const em = report?.emergency as Record<string, unknown> | undefined;
  const metrics = report?.metrics as Record<string, number | null> | undefined;

  return (
    <AdminShell user={user}>
      <Link href={`/admin/emergencies/${emergencyId}`} className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Post-Incident Report</h1>

      {!em ? (
        <div className="mt-8 h-40 animate-pulse rounded-2xl bg-glass" />
      ) : (
        <div className="mt-6 space-y-6">
          <section className="rounded-2xl border border-border p-5">
            <h2 className="text-sm font-semibold">Emergency Summary</h2>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">ID</dt><dd className="font-mono">{String(em.emergencyId)}</dd></div>
              <div><dt className="text-muted">Type</dt><dd>{String(em.type)}</dd></div>
              <div><dt className="text-muted">Status</dt><dd>{String(em.status)}</dd></div>
              <div><dt className="text-muted">Source</dt><dd>{String(em.source)}</dd></div>
              <div><dt className="text-muted">Activated</dt><dd>{new Date(String(em.activatedAt)).toLocaleString()} by {String(em.activatedByName)}</dd></div>
              <div><dt className="text-muted">Resolved</dt><dd>{em.resolvedAt ? `${new Date(String(em.resolvedAt)).toLocaleString()} by ${String(em.resolvedByName)}` : "—"}</dd></div>
            </dl>
          </section>

          <section className="rounded-2xl border border-border p-5">
            <h2 className="text-sm font-semibold">Response Metrics</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-black/20 p-3"><p className="text-[10px] text-muted">Total Duration</p><p className="text-lg font-bold">{formatDuration(metrics?.totalDurationMs ?? null)}</p></div>
              <div className="rounded-lg bg-black/20 p-3"><p className="text-[10px] text-muted">Ack → Response</p><p className="text-lg font-bold">{formatDuration(metrics?.ackToResponseMs ?? null)}</p></div>
              <div className="rounded-lg bg-black/20 p-3"><p className="text-[10px] text-muted">Response → Resolution</p><p className="text-lg font-bold">{formatDuration(metrics?.responseToResolutionMs ?? null)}</p></div>
            </div>
            <p className="mt-2 text-[10px] text-muted">Metrics use stored server timestamps only.</p>
          </section>

          <section className="rounded-2xl border border-border p-5">
            <h2 className="text-sm font-semibold">Timeline</h2>
            <ul className="mt-3 space-y-2">
              {((em.timeline as Array<Record<string, string>>) ?? []).map((t, i) => (
                <li key={i} className="text-xs">
                  <span className="text-muted">{new Date(t.timestamp).toLocaleString()}</span> — {t.action}: {t.description}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-border p-5">
            <h2 className="text-sm font-semibold">Lessons / Notes</h2>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="mt-3 w-full rounded-lg border border-border bg-black/20 px-3 py-2 text-sm" />
            <button type="button" onClick={saveNotes} className="mt-2 rounded-lg bg-accent/20 px-4 py-2 text-xs text-accent">Save Notes</button>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
