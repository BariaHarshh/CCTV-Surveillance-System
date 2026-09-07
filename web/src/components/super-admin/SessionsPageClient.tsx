"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";
import { EmptyState } from "@/components/super-admin/EmptyState";
import { formatRelativeTime } from "@/lib/utils/time";
import type { SafeUser } from "@/lib/auth/sanitize-user";

export function SessionsPageClient({ user }: { user: SafeUser }) {
  const [sessions, setSessions] = useState<
    { id: string; userName: string; userAgent: string; ipAddress: string; lastActivity: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    fetch("/api/super-admin/sessions", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const revoke = async (id: string) => {
    if (!confirm("Revoke this session?")) return;
    await fetch(`/api/super-admin/sessions/${id}`, { method: "DELETE", credentials: "include" });
    load();
  };

  return (
    <SuperAdminShell user={user}>
      <h1 className="text-2xl font-bold">Active Sessions</h1>
      {loading ? (
        <Loader2 className="mt-12 h-8 w-8 animate-spin text-accent" />
      ) : sessions.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No active sessions" description="Platform sessions will appear here when users are logged in." />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="flex flex-col gap-2 rounded-xl border border-border bg-surface/40 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{s.userName}</p>
                <p className="mt-1 text-xs text-muted truncate max-w-lg">{s.userAgent}</p>
                <p className="text-xs text-muted">
                  {s.ipAddress} · {formatRelativeTime(new Date(s.lastActivity))}
                </p>
              </div>
              <button type="button" onClick={() => revoke(s.id)} className="text-sm text-red-400">
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </SuperAdminShell>
  );
}
