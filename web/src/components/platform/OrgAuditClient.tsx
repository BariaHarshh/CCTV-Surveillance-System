"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import type { SafeUser } from "@/lib/auth/sanitize-user";

type Log = {
  id: string;
  description: string;
  actorName: string;
  action: string;
  createdAt: string;
};

export function OrgAuditClient({ user }: { user: SafeUser }) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/audit/org", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setLogs(j.logs ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Audit log</h1>
      <p className="mt-1 text-muted">Organization activity trail</p>
      {loading ? (
        <Loader2 className="mt-12 h-8 w-8 animate-spin text-accent" />
      ) : logs.length === 0 ? (
        <p className="mt-8 text-sm text-muted">
          No organization audit events yet. Sensitive settings changes are recorded automatically.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-white/[0.04]">
                  <td className="px-4 py-3">{l.description}</td>
                  <td className="px-4 py-3 text-muted">{l.actorName}</td>
                  <td className="px-4 py-3 font-mono text-xs">{l.action}</td>
                  <td className="px-4 py-3 text-muted">{new Date(l.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
