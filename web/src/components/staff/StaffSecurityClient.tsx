"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StaffShell } from "./StaffShell";
import { formatRelativeTime } from "@/lib/utils/time";
import type { SafeUser } from "@/lib/auth/sanitize-user";

export function StaffSecurityClient({ user }: { user: SafeUser }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    fetch("/api/staff/security", { credentials: "include" })
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const revokeOthers = async () => {
    await fetch("/api/staff/security", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout_others" }) });
    load();
  };

  const revoke = async (id: string) => {
    await fetch(`/api/staff/sessions/${id}`, { method: "DELETE", credentials: "include" });
    load();
  };

  const sessions = (data?.sessions as Array<Record<string, unknown>>) ?? [];

  return (
    <StaffShell user={user}>
      <h1 className="text-2xl font-bold">Security</h1>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/change-password" className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-background">Change Password</Link>
        <button type="button" onClick={revokeOthers} className="rounded-full border border-border px-5 py-2 text-sm">Logout Other Sessions</button>
      </div>

      <section className="mt-8 rounded-2xl border border-border bg-surface/50 p-6">
        <h2 className="font-semibold">Password</h2>
        <p className="mt-2 text-sm text-muted">Last changed: {data?.passwordChangedAt ? formatRelativeTime(new Date(data.passwordChangedAt as string)) : "Never"}</p>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-border">
        <h2 className="border-b border-border bg-surface/50 px-4 py-3 font-semibold">Active Sessions</h2>
        {loading ? (
          <div className="p-4"><div className="h-20 animate-pulse rounded-xl bg-glass" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead><tr className="border-b border-border text-xs text-muted"><th className="px-4 py-3">Device</th><th className="px-4 py-3">Last Active</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr></thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={String(s.id)} className="border-b border-white/[0.04]">
                    <td className="px-4 py-3">{String(s.device)}</td>
                    <td className="px-4 py-3 text-muted">{s.lastActive ? formatRelativeTime(new Date(s.lastActive as string)) : "—"}</td>
                    <td className="px-4 py-3">{String(s.status)}{s.isCurrent ? " (current)" : ""}</td>
                    <td className="px-4 py-3">{!s.isCurrent && <button type="button" onClick={() => revoke(String(s.id))} className="text-xs text-red-400">Revoke</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </StaffShell>
  );
}
