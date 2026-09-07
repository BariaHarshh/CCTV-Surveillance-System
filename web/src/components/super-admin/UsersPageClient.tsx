"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, RefreshCw, Search, X } from "lucide-react";
import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";
import { StatusBadge } from "@/components/super-admin/StatusBadge";
import { EmptyState } from "@/components/super-admin/EmptyState";
import { formatRelativeTime } from "@/lib/utils/time";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { cn } from "@/lib/utils";

interface UserRow {
  id: string;
  name: string;
  userId: string;
  email: string;
  role: string;
  status: string;
  organizationName: string;
  lastLogin: string | null;
  isOnline: boolean;
}

interface UserDetail {
  user: Record<string, unknown>;
  sessions: { id: string; userAgent: string; ipAddress: string; lastActivity: string }[];
}

export function UsersPageClient({ currentUser }: { currentUser: SafeUser }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [online, setOnline] = useState("all");
  const [selected, setSelected] = useState<UserDetail | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    userId: string;
    action: "activate" | "suspend" | "unlock";
    name: string;
  } | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, role, status, online });
      const res = await fetch(`/api/super-admin/users?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      setUsers(data.users);
      setError(null);
    } catch {
      setError("Unable to load users");
    } finally {
      setLoading(false);
    }
  }, [q, role, status, online]);

  useEffect(() => {
    const t = setTimeout(fetchUsers, 300);
    return () => clearTimeout(t);
  }, [fetchUsers]);

  const openUser = async (id: string) => {
    const res = await fetch(`/api/super-admin/users/${id}`, { credentials: "include" });
    if (res.ok) setSelected(await res.json());
  };

  const performAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/super-admin/users/${confirmAction.userId}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: confirmAction.action }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Action failed");
        return;
      }
      setConfirmAction(null);
      await fetchUsers();
      if (selected) await openUser(confirmAction.userId);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <SuperAdminShell user={currentUser}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-bold">User Management</h1>
        <p className="mt-1 text-muted">Search and manage platform users</p>

        <div className="mt-6 flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, user ID, or email..."
              className="w-full rounded-xl border border-border bg-glass py-2.5 pl-10 pr-4 text-sm outline-none focus:border-accent/40"
            />
          </div>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          >
            <option value="ALL">All Roles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="ADMIN">Admin</option>
            <option value="STAFF">Staff</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="LOCKED">Locked</option>
          </select>
          <select
            value={online}
            onChange={(e) => setOnline(e.target.value)}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
        </div>

        {error ? (
          <div className="mt-8 text-center">
            <p className="text-red-400">{error}</p>
            <button type="button" onClick={fetchUsers} className="mt-4 text-accent">
              <RefreshCw className="inline h-4 w-4" /> Retry
            </button>
          </div>
        ) : loading ? (
          <div className="mt-12 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        ) : users.length === 0 ? (
          <div className="mt-8">
            <EmptyState title="No users found" description="Try adjusting your search or filters." />
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-border bg-surface/60 text-xs text-muted uppercase">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">User ID</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Online</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-white/[0.04] hover:bg-glass">
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{u.userId}</td>
                    <td className="px-4 py-3">{u.role.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-muted">{u.organizationName}</td>
                    <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                    <td className="px-4 py-3">
                      <span className={cn("h-2 w-2 rounded-full inline-block", u.isOnline ? "bg-emerald-400" : "bg-slate-500")} />
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => openUser(u.id)} className="text-accent hover:underline">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selected && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
            <motion.div
              initial={{ x: 400 }}
              animate={{ x: 0 }}
              className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-surface p-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">User Details</h2>
                <button type="button" onClick={() => setSelected(null)} aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <dl className="mt-6 space-y-4 text-sm">
                {Object.entries({
                  Name: selected.user.name,
                  "User ID": selected.user.userId,
                  Email: selected.user.email,
                  Role: selected.user.role,
                  Organization: selected.user.organizationName,
                  Status: selected.user.status,
                  "Last Login": selected.user.lastLogin
                    ? formatRelativeTime(new Date(selected.user.lastLogin as string))
                    : "Never",
                  "Last Active": selected.user.lastActive
                    ? formatRelativeTime(new Date(selected.user.lastActive as string))
                    : "Never",
                  "Failed Attempts": selected.user.failedLoginAttempts,
                }).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-muted">{k}</dt>
                    <dd className="text-right font-medium">{String(v)}</dd>
                  </div>
                ))}
              </dl>
              {selected.user.role !== "SUPER_ADMIN" && (
                <div className="mt-8 flex flex-wrap gap-2">
                  {(["activate", "suspend", "unlock"] as const).map((action) => (
                    <button
                      key={action}
                      type="button"
                      onClick={() =>
                        setConfirmAction({
                          userId: selected.user.id as string,
                          action,
                          name: selected.user.name as string,
                        })
                      }
                      className="rounded-lg border border-border px-3 py-1.5 text-xs capitalize hover:bg-glass"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}

        {confirmAction && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-6">
            <div className="gradient-border max-w-sm rounded-2xl bg-surface p-6">
              <h3 className="font-semibold capitalize">Confirm {confirmAction.action}</h3>
              <p className="mt-2 text-sm text-muted">
                Are you sure you want to {confirmAction.action} <strong>{confirmAction.name}</strong>?
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={performAction}
                  className="flex-1 rounded-full bg-accent py-2 text-sm font-semibold text-background"
                >
                  {actionLoading ? "Processing..." : "Confirm"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 rounded-full border border-border py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </SuperAdminShell>
  );
}
