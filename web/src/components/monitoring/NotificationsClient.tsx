"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, RefreshCw } from "lucide-react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";
import { SeverityBadge, formatDateTime } from "./shared";
import { useMonitoringSocket } from "@/hooks/useMonitoringSocket";
import { RealtimeIndicator } from "./shared";
import Link from "next/link";

interface NotificationRow {
  id: string;
  notificationId: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  read: boolean;
  alertId: string | null;
  createdAt: string;
}

export function NotificationsClient({ user }: { user: SafeUser }) {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter === "unread" ? "?unread=true" : "";
      const res = await fetch(`/api/notifications${params}`, { credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setItems(data.notifications ?? []);
        setUnread(data.unread ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const { status: realtimeStatus } = useMonitoringSocket({ onNotification: () => load() });

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH", credentials: "include" });
    load();
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "PATCH", credentials: "include" });
    load();
  }

  const stats = {
    unread,
    read: items.filter((n) => n.read).length,
    critical: items.filter((n) => n.severity === "CRITICAL").length,
    security: items.filter((n) => n.type === "SECURITY" || n.type === "ALERT").length,
    system: items.filter((n) => n.type === "SYSTEM").length,
  };

  return (
    <AdminShell user={user}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Notification Center</h1>
          <p className="mt-1 text-muted">Real-time security and system notifications.</p>
        </div>
        <div className="flex items-center gap-3">
          <RealtimeIndicator status={realtimeStatus} />
          <button type="button" onClick={load} className="rounded-full border border-border p-2 text-muted hover:text-foreground">
            <RefreshCw className="h-4 w-4" />
          </button>
          {unread > 0 && (
            <button type="button" onClick={markAllRead} className="rounded-full bg-accent/10 px-4 py-2 text-xs font-medium text-accent">
              Mark All as Read
            </button>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Unread", value: stats.unread },
          { label: "Read", value: stats.read },
          { label: "Critical", value: stats.critical },
          { label: "Security", value: stats.security },
          { label: "System", value: stats.system },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-surface/50 p-4">
            <p className="text-xs text-muted">{s.label}</p>
            <p className="mt-1 text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex gap-2">
        {(["all", "unread"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-lg px-4 py-2 text-xs font-medium capitalize ${filter === f ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-glass" />)
        ) : items.length === 0 ? (
          <p className="rounded-xl border border-border p-8 text-center text-muted">No notifications.</p>
        ) : (
          items.map((n) => (
            <div key={n.id} className={`flex items-start justify-between gap-4 rounded-xl border px-4 py-4 ${n.read ? "border-white/[0.04] opacity-70" : "border-accent/20 bg-accent/5"}`}>
              <div className="flex gap-3">
                <Bell className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                <div>
                  <p className="font-medium">{n.title}</p>
                  <p className="text-sm text-muted">{n.message}</p>
                  <p className="mt-1 text-xs text-muted">{formatDateTime(n.createdAt)}</p>
                  {n.alertId && (
                    <Link href={`/admin/alerts/${n.alertId}`} className="mt-1 inline-block text-xs text-accent hover:underline">View alert</Link>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <SeverityBadge severity={n.severity} />
                {!n.read && (
                  <button type="button" onClick={() => markRead(n.id)} className="text-[10px] text-accent hover:underline">Mark as Read</button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </AdminShell>
  );
}
