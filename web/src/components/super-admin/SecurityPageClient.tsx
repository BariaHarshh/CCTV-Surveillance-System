"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";
import { EmptyState } from "@/components/super-admin/EmptyState";
import { formatRelativeTime } from "@/lib/utils/time";
import type { SafeUser } from "@/lib/auth/sanitize-user";

interface SessionRow {
  id: string;
  userId: string;
  userAgent: string;
  ipAddress: string;
  lastActivity: string;
  createdAt: string;
}

export function SecurityPageClient({ user }: { user: SafeUser }) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<{
    user: {
      failedLoginAttempts?: number;
      passwordChangedAt?: string;
    };
  } | null>(null);

  const load = async () => {
    setLoading(true);
    const [sessRes, userRes] = await Promise.all([
      fetch("/api/super-admin/sessions", { credentials: "include" }),
      fetch(`/api/super-admin/users/${user.id}`, { credentials: "include" }),
    ]);
    if (sessRes.ok) {
      const d = await sessRes.json();
      setSessions(
        d.sessions.filter((s: { userId: string }) => s.userId === user.id)
      );
    }
    if (userRes.ok) setDetail(await userRes.json());
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user.id]);

  const revoke = async (id: string) => {
    if (!confirm("Revoke this session?")) return;
    await fetch(`/api/super-admin/sessions/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    await load();
  };

  return (
    <SuperAdminShell user={user}>
      <h1 className="text-2xl font-bold">Account Security</h1>
      {loading ? (
        <Loader2 className="mt-12 h-8 w-8 animate-spin text-accent" />
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="gradient-border rounded-2xl bg-surface/60 p-6">
            <h2 className="font-semibold">Login Protection</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Failed Login Attempts</dt>
                <dd>{detail?.user.failedLoginAttempts ?? 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Password Last Changed</dt>
                <dd>
                  {detail?.user.passwordChangedAt
                    ? formatRelativeTime(new Date(detail.user.passwordChangedAt as string))
                    : "Unknown"}
                </dd>
              </div>
            </dl>
          </div>
          <div className="gradient-border rounded-2xl bg-surface/60 p-6 lg:col-span-2">
            <h2 className="font-semibold">Active Sessions</h2>
            {sessions.length === 0 ? (
              <EmptyState title="No active sessions" description="Your active sessions will appear here." />
            ) : (
              <div className="mt-4 space-y-3">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-col gap-2 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="text-sm">
                      <p className="font-medium truncate max-w-md">{s.userAgent || "Unknown device"}</p>
                      <p className="mt-1 text-xs text-muted">
                        {s.ipAddress} · Last active {formatRelativeTime(new Date(s.lastActivity))}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => revoke(s.id)}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </SuperAdminShell>
  );
}
