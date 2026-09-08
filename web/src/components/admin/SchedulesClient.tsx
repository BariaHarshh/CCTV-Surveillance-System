"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";

interface Schedule {
  id: string;
  scheduleId: string;
  name: string;
  timezone: string;
  windows: { dayOfWeek: number; startTime: string; endTime: string }[];
  exceptions: { date: string; label: string; closed: boolean }[];
  status: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function SchedulesClient({ user }: { user: SafeUser }) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/schedules", { credentials: "include" });
    const data = await res.json();
    if (res.ok) setSchedules(data.schedules ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createDefault() {
    await fetch("/api/admin/schedules", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Business Hours",
        windows: [1, 2, 3, 4, 5].map((d) => ({ dayOfWeek: d, startTime: "08:00", endTime: "18:00" })),
      }),
    });
    load();
  }

  return (
    <AdminShell user={user}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin/ai" className="text-xs text-accent hover:underline">← AI Intelligence</Link>
          <h1 className="mt-2 text-2xl font-bold">Detection Schedules</h1>
          <p className="mt-1 text-sm text-muted">After-hours rules, holidays, and campus closure exceptions.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={createDefault} className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-background">
            <Plus className="h-3.5 w-3.5" /> Add Business Hours
          </button>
          <button type="button" onClick={load} className="rounded-full border border-border p-2 text-muted"><RefreshCw className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="h-24 animate-pulse rounded-xl bg-glass" />
        ) : schedules.length === 0 ? (
          <p className="rounded-xl border border-border p-8 text-center text-muted">No schedules yet.</p>
        ) : schedules.map((s) => (
          <div key={s.id} className="rounded-2xl border border-border bg-surface/50 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-xs text-muted">{s.scheduleId}</p>
                <h3 className="font-semibold">{s.name}</h3>
              </div>
              <span className="text-xs text-muted">{s.status}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {s.windows.map((w, i) => (
                <span key={i} className="rounded-lg bg-glass px-2 py-1 text-[10px] text-muted">
                  {DAYS[w.dayOfWeek]} {w.startTime}–{w.endTime}
                </span>
              ))}
            </div>
            {s.exceptions.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] uppercase tracking-wider text-muted">Exceptions</p>
                {s.exceptions.map((ex, i) => (
                  <p key={i} className="text-xs text-muted">{ex.date} — {ex.label} {ex.closed ? "(Closed)" : ""}</p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
