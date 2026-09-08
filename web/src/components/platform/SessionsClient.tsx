"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { formatRelativeTime } from "@/lib/utils/time";
import type { SafeUser } from "@/lib/auth/sanitize-user";

type SessionRow = {
  id: string;
  device: string;
  ipAddress: string;
  lastActive: string | null;
  isCurrent: boolean;
  status: string;
};

export function SessionsClient({ user }: { user: SafeUser }) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setError("");
    const res = await fetch("/api/staff/security", { credentials: "include" });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error ?? "Failed to load sessions.");
      setLoading(false);
      return;
    }
    setSessions(j.sessions ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function revokeOthers() {
    setMsg("");
    const res = await fetch("/api/staff/security", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout_others" }),
    });
    if (res.ok) {
      setMsg("Other sessions revoked.");
      load();
    }
  }

  async function revoke(id: string) {
    await fetch(`/api/staff/sessions/${id}`, { method: "DELETE", credentials: "include" });
    load();
  }

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Active Sessions</h1>
      <p className="mt-1 text-sm text-muted">Devices signed in to your account</p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/change-password" className="rounded-xl border border-border px-4 py-2 text-sm hover:border-accent/40">
          Change password
        </Link>
        <button
          type="button"
          onClick={revokeOthers}
          className="rounded-xl border border-border px-4 py-2 text-sm hover:border-accent/40"
        >
          Log out other sessions
        </button>
      </div>

      {msg && <p className="mt-4 text-sm text-accent">{msg}</p>}
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <section className="mt-6 overflow-hidden rounded-2xl border border-border">
        {loading ? (
          <div className="p-6">
            <div className="h-24 animate-pulse rounded-xl bg-glass" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Device</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">Last active</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-b border-white/[0.04]">
                    <td className="px-4 py-3">{s.device}</td>
                    <td className="px-4 py-3 text-muted">{s.ipAddress}</td>
                    <td className="px-4 py-3 text-muted">
                      {s.lastActive ? formatRelativeTime(new Date(s.lastActive)) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {s.status}
                      {s.isCurrent ? " (current)" : ""}
                    </td>
                    <td className="px-4 py-3">
                      {!s.isCurrent && (
                        <button type="button" onClick={() => revoke(s.id)} className="text-xs text-red-400 hover:text-red-300">
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted">
                      No active sessions.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
