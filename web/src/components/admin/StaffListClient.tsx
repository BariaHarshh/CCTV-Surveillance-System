"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Loader2, MoreHorizontal, Plus, RefreshCw, Search } from "lucide-react";
import { AdminShell } from "./AdminShell";
import { StatCard, StatCardSkeleton } from "@/components/super-admin/StatCard";
import { EmptyState } from "@/components/super-admin/EmptyState";
import { StatusBadge } from "@/components/super-admin/StatusBadge";
import { formatRelativeTime } from "@/lib/utils/time";
import type { SafeUser } from "@/lib/auth/sanitize-user";

interface StaffRow {
  id: string;
  name: string;
  userId: string;
  email: string;
  status: string;
  professional: { department: string; jobTitle: string; employeeId: string };
  lastLogin: string | null;
  isOnline?: boolean;
}

export function StaffListClient({ user }: { user: SafeUser }) {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [stats, setStats] = useState<{ total: number; active: number; inactive: number; suspended: number; pending: number; online: number } | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [department, setDepartment] = useState("ALL");
  const [online, setOnline] = useState("ALL");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const [error, setError] = useState("");

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status !== "ALL") params.set("status", status);
      if (department !== "ALL") params.set("department", department);
      if (online !== "ALL") params.set("online", online);
      const res = await fetch(`/api/admin/staff?${params}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Unable to load staff.");
        setStaff([]);
        return;
      }
      setStaff(json.staff ?? []);
      setDepartments(json.departments ?? []);
      const dash = await fetch("/api/admin/dashboard", { credentials: "include" });
      const dashJson = await dash.json();
      if (dash.ok) setStats(dashJson.statistics?.staff ?? null);
    } catch {
      setError("Unable to load staff. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [q, status, department, online]);

  useEffect(() => {
    const t = setTimeout(fetchStaff, 300);
    return () => clearTimeout(t);
  }, [fetchStaff]);

  const handleStatus = async (id: string, action: "activate" | "suspend" | "unlock", newStatus: string) => {
    setActionLoading(id);
    try {
      await fetch(`/api/admin/staff/${id}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, action }),
      });
      await fetchStaff();
    } finally {
      setActionLoading(null);
      setMenuOpen(null);
    }
  };

  const handleResetPassword = async (id: string) => {
    if (!confirm("Reset this staff member's password? They will receive a new temporary password.")) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/staff/${id}/reset-password`, { method: "POST", credentials: "include" });
      const json = await res.json();
      if (res.ok && json.temporaryPassword) {
        alert(`Temporary password: ${json.temporaryPassword}\n\nShare securely. Staff must change on first login.`);
      }
      await fetchStaff();
    } finally {
      setActionLoading(null);
      setMenuOpen(null);
    }
  };

  return (
    <AdminShell user={user}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold">Staff</h1>
          <p className="mt-1 text-muted">Manage staff members within your organization.</p>
        </div>
        <Link href="/admin/staff/new" className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-background">
          <Plus className="h-4 w-4" /> Create Staff
        </Link>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">{error}</p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {loading && !stats ? (
          Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : stats ? (
          <>
            <StatCard label="Total Staff" value={stats.total} icon={RefreshCw} delay={0} />
            <StatCard label="Active" value={stats.active} icon={RefreshCw} delay={0} />
            <StatCard label="Inactive" value={stats.inactive} icon={RefreshCw} delay={0} />
            <StatCard label="Suspended" value={stats.suspended} icon={RefreshCw} delay={0} />
            <StatCard label="Pending" value={stats.pending} icon={RefreshCw} delay={0} />
            <StatCard label="Online" value={stats.online} icon={RefreshCw} delay={0} />
          </>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ID, email, department..." className="w-full rounded-xl border border-border bg-glass py-2.5 pl-10 pr-4 text-sm outline-none focus:border-accent/40" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-border bg-glass px-4 py-2.5 text-sm">
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="PENDING">Pending</option>
        </select>
        <select value={department} onChange={(e) => setDepartment(e.target.value)} className="rounded-xl border border-border bg-glass px-4 py-2.5 text-sm">
          <option value="ALL">All Departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={online} onChange={(e) => setOnline(e.target.value)} className="rounded-xl border border-border bg-glass px-4 py-2.5 text-sm">
          <option value="ALL">All</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface/30">
        {loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-glass" />)}</div>
        ) : staff.length === 0 ? (
          <>
            <EmptyState title="No staff members" description="Create your first staff account to get started." icon="inbox" />
            <div className="pb-8 text-center">
              <Link href="/admin/staff/new" className="inline-flex rounded-full bg-accent px-5 py-2 text-sm font-semibold text-background">Create Staff</Link>
            </div>
          </>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th className="px-4 py-3 font-medium">Staff</th>
                  <th className="px-4 py-3 font-medium">Staff ID</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Position</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Last Login</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="border-b border-white/[0.04] hover:bg-glass">
                    <td className="px-4 py-3">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted">{s.email}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{s.userId}</td>
                    <td className="px-4 py-3">{s.professional?.department || "—"}</td>
                    <td className="px-4 py-3">{s.professional?.jobTitle || "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                      {s.isOnline && <span className="ml-2 text-xs text-emerald-400">Online</span>}
                    </td>
                    <td className="px-4 py-3 text-muted">{s.lastLogin ? formatRelativeTime(new Date(s.lastLogin)) : "Never"}</td>
                    <td className="relative px-4 py-3">
                      <button type="button" onClick={() => setMenuOpen(menuOpen === s.id ? null : s.id)} className="rounded-lg p-2 hover:bg-glass-hover">
                        {actionLoading === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                      </button>
                      {menuOpen === s.id && (
                        <div className="absolute right-4 z-10 mt-1 w-44 rounded-xl border border-border bg-surface py-1 shadow-xl">
                          <Link href={`/admin/staff/${s.id}`} className="flex items-center gap-2 px-3 py-2 hover:bg-glass"><Eye className="h-3.5 w-3.5" /> View</Link>
                          {s.status !== "ACTIVE" && <button type="button" onClick={() => handleStatus(s.id, "activate", "ACTIVE")} className="w-full px-3 py-2 text-left hover:bg-glass">Activate</button>}
                          {s.status === "ACTIVE" && <button type="button" onClick={() => handleStatus(s.id, "suspend", "SUSPENDED")} className="w-full px-3 py-2 text-left hover:bg-glass">Suspend</button>}
                          <button type="button" onClick={() => handleResetPassword(s.id)} className="w-full px-3 py-2 text-left hover:bg-glass">Reset Password</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
