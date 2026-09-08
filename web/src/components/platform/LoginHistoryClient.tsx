"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import type { SafeUser } from "@/lib/auth/sanitize-user";

type Row = {
  id: string;
  user: string;
  timestamp: string | null;
  ip: string | null;
  device: string | null;
  success: boolean;
  reason: string;
};

export function LoginHistoryClient({ user }: { user: SafeUser }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/login-history", { credentials: "include" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Failed to load");
        setRows(j.history ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Login History</h1>
      <p className="mt-1 text-sm text-muted">Organization authentication activity — admin/security access only.</p>
      {loading && <div className="mt-8 h-24 animate-pulse rounded-xl bg-glass" />}
      {error && <p className="mt-6 text-sm text-rose-300">{error}</p>}
      {!loading && !error && rows.length === 0 && (
        <p className="mt-8 text-sm text-muted">No login activity recorded yet.</p>
      )}
      {rows.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Timestamp</th>
                <th className="px-3 py-2">IP</th>
                <th className="px-3 py-2">Device</th>
                <th className="px-3 py-2">Result</th>
                <th className="px-3 py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="px-3 py-2">{r.user}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.timestamp ? new Date(r.timestamp).toLocaleString() : "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.ip ?? "—"}</td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-xs text-muted" title={r.device ?? ""}>
                    {r.device ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={r.success ? "text-emerald-300" : "text-rose-300"}>
                      {r.success ? "Success" : "Failure"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
