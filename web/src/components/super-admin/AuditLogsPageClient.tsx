"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";
import { EmptyState } from "@/components/super-admin/EmptyState";
import { formatRelativeTime } from "@/lib/utils/time";
import type { SafeUser } from "@/lib/auth/sanitize-user";

export function AuditLogsPageClient({ user }: { user: SafeUser }) {
  const [logs, setLogs] = useState<
    { id: string; description: string; actor: string; action: string; severity: string; createdAt: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/super-admin/activity", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setLogs(d.activity))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SuperAdminShell user={user}>
      <h1 className="text-2xl font-bold">Audit Logs</h1>
      <p className="mt-1 text-muted">Platform-wide activity and audit trail</p>
      {loading ? (
        <Loader2 className="mt-12 h-8 w-8 animate-spin text-accent" />
      ) : logs.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No audit logs yet" description="Audit events will be recorded as platform activity occurs." />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border bg-surface/60 text-xs text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-white/[0.04]">
                  <td className="px-4 py-3">{log.description}</td>
                  <td className="px-4 py-3 text-muted">{log.actor}</td>
                  <td className="px-4 py-3 font-mono text-xs">{log.action}</td>
                  <td className="px-4 py-3 text-muted">
                    {formatRelativeTime(new Date(log.createdAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SuperAdminShell>
  );
}
