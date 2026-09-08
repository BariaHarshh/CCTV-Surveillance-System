"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Search } from "lucide-react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { MonitoringPortal } from "./MonitoringPortal";
import { SeverityBadge, formatDateTime, formatEventType } from "./shared";
import { useMonitoringSocket } from "@/hooks/useMonitoringSocket";
import { RealtimeIndicator } from "./shared";

interface EventRow {
  id: string;
  eventId: string;
  eventType: string;
  severity: string;
  status: string;
  locationLabel: string;
  detectedAt: string;
  source: string;
}

export function EventsClient({ user, portal }: { user: SafeUser; portal: "admin" | "staff" }) {
  const base = portal === "admin" ? "/admin" : "/staff";
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState("ALL");
  const [eventType, setEventType] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "30" });
      if (q) params.set("q", q);
      if (severity !== "ALL") params.set("severity", severity);
      if (eventType) params.set("eventType", eventType);
      const res = await fetch(`/api/events?${params}`, { credentials: "include" });
      const data = await res.json();
      if (res.ok) setEvents(data.events ?? []);
    } finally {
      setLoading(false);
    }
  }, [page, q, severity, eventType]);

  useEffect(() => {
    load();
  }, [load]);

  const { status: realtimeStatus } = useMonitoringSocket({ onEventCreated: () => load() });

  return (
    <MonitoringPortal portal={portal} user={user}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Event Timeline</h1>
          <p className="mt-1 text-muted">Chronological detection events across your campus.</p>
        </div>
        <div className="flex items-center gap-3">
          <RealtimeIndicator status={realtimeStatus} />
          <button type="button" onClick={load} className="rounded-full border border-border p-2 text-muted hover:text-foreground">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Search events..."
            className="w-full rounded-xl border border-border bg-glass py-2.5 pl-10 pr-4 text-sm outline-none focus:border-accent/50"
          />
        </div>
        <select value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }} className="rounded-xl border border-border bg-glass px-4 py-2.5 text-sm">
          <option value="ALL">All severities</option>
          {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          value={eventType}
          onChange={(e) => { setEventType(e.target.value); setPage(1); }}
          placeholder="Event type filter"
          className="rounded-xl border border-border bg-glass px-4 py-2.5 text-sm"
        />
      </div>

      <div className="mt-6 space-y-2">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-glass" />)
        ) : events.length === 0 ? (
          <p className="rounded-xl border border-border p-8 text-center text-muted">No events found.</p>
        ) : (
          events.map((e) => (
            <Link key={e.id} href={`${base}/events/${e.id}`} className="flex items-center justify-between rounded-xl border border-border px-4 py-4 hover:bg-glass">
              <div>
                <p className="text-xs text-muted">{formatDateTime(e.detectedAt)}</p>
                <p className="font-medium">{formatEventType(e.eventType)}{e.source === "TEST" ? " (SIMULATED)" : ""}</p>
                <p className="text-xs text-muted">{e.locationLabel || "—"}</p>
              </div>
              <SeverityBadge severity={e.severity} />
            </Link>
          ))
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-40">Prev</button>
        <button type="button" onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-border px-3 py-1.5 text-xs">Next</button>
      </div>
    </MonitoringPortal>
  );
}
