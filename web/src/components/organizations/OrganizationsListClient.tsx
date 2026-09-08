"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Building2,
  Camera,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";
import { StatCard, StatCardSkeleton } from "@/components/super-admin/StatCard";
import { StatusBadge } from "@/components/super-admin/StatusBadge";
import { EmptyState } from "@/components/super-admin/EmptyState";
import { formatRelativeTime } from "@/lib/utils/time";
import { ORGANIZATION_TYPES } from "@/lib/organizations/constants";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { cn } from "@/lib/utils";

interface OrgRow {
  id: string;
  organizationId: string;
  name: string;
  type: string;
  location: string;
  admins: number;
  staff: number;
  status: string;
  createdAt: string;
  lastActivity: string;
}

interface OrgStats {
  total: number;
  active: number;
  pending: number;
  suspended: number;
  inactive: number;
  totalCameras: number;
  totalCampusUsers: number;
}

export function OrganizationsListClient({ user }: { user: SafeUser }) {
  const router = useRouter();
  const [stats, setStats] = useState<OrgStats | null>(null);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    | { kind: "delete"; id: string; name: string }
    | { kind: "status"; id: string; name: string; status: string }
    | null
  >(null);
  const [confirmInput, setConfirmInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (q) params.set("q", q);
      if (status !== "ALL") params.set("status", status);
      if (type !== "ALL") params.set("type", type);

      const [listRes, statsRes] = await Promise.all([
        fetch(`/api/super-admin/organizations?${params}`, { credentials: "include" }),
        fetch("/api/super-admin/organizations?stats=true", { credentials: "include" }),
      ]);
      if (listRes.ok) {
        const data = await listRes.json();
        setOrgs(data.organizations);
        setTotalPages(data.pagination.totalPages);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }
    } finally {
      setLoading(false);
    }
  }, [q, status, type, page]);

  useEffect(() => {
    const t = setTimeout(fetchData, 300);
    return () => clearTimeout(t);
  }, [fetchData]);

  const performConfirm = async () => {
    if (!confirm) return;
    setActionLoading(true);
    try {
      if (confirm.kind === "delete") {
        const res = await fetch(`/api/super-admin/organizations/${confirm.id}`, {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmName: confirmInput }),
        });
        if (!res.ok) {
          const err = await res.json();
          alert(err.error ?? "Delete failed");
          return;
        }
      } else {
        const res = await fetch(`/api/super-admin/organizations/${confirm.id}/status`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: confirm.status }),
        });
        if (!res.ok) {
          const err = await res.json();
          alert(err.error ?? "Status update failed");
          return;
        }
      }
      setConfirm(null);
      setConfirmInput("");
      await fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <SuperAdminShell user={user}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Organizations</h1>
          <p className="mt-1 text-muted">Manage institutions connected to AI Campus Guardian.</p>
        </div>
        <Link
          href="/super-admin/organizations/new"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-background"
        >
          <Plus className="h-4 w-4" />
          Create Organization
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats ? (
          <>
            <StatCard label="Total Organizations" value={stats.total} icon={Building2} delay={0} />
            <StatCard label="Active Organizations" value={stats.active} icon={Building2} delay={0.05} />
            <StatCard label="Pending Organizations" value={stats.pending} icon={Building2} delay={0.1} />
            <StatCard label="Suspended Organizations" value={stats.suspended} icon={Building2} delay={0.15} />
            <StatCard label="Total Campus Users" value={stats.totalCampusUsers} icon={Users} delay={0.2} />
            <StatCard label="Total Cameras" value={stats.totalCameras} icon={Camera} delay={0.25} />
          </>
        ) : (
          Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
        )}
      </div>

      <div className="mt-8 flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Search by name, ID, or city..."
            className="w-full rounded-xl border border-border bg-glass py-2.5 pl-10 pr-4 text-sm outline-none focus:border-accent/40"
          />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING">Pending</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
          <option value="ALL">All Types</option>
          {ORGANIZATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button type="button" onClick={fetchData} className="rounded-xl border border-border px-3 py-2 text-sm">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 overflow-hidden rounded-2xl border border-border">
        {loading && orgs.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-accent" />
          </div>
        ) : orgs.length === 0 ? (
          <EmptyState
            icon="building"
            title="No organizations found"
            description="Create your first organization to begin onboarding institutions."
            actionLabel="Create Organization"
            onAction={() => router.push("/super-admin/organizations/new")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-medium">Organization</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Admins</th>
                  <th className="px-4 py-3 font-medium">Staff</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Last Activity</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr key={org.id} className="border-b border-white/[0.04] hover:bg-glass">
                    <td className="px-4 py-3">
                      <Link href={`/super-admin/organizations/${org.id}`} className="font-medium hover:text-accent">
                        {org.name}
                      </Link>
                      <p className="text-xs text-muted">{org.organizationId}</p>
                    </td>
                    <td className="px-4 py-3">{org.type}</td>
                    <td className="px-4 py-3">{org.location}</td>
                    <td className="px-4 py-3">{org.admins}</td>
                    <td className="px-4 py-3">{org.staff}</td>
                    <td className="px-4 py-3"><StatusBadge status={org.status} /></td>
                    <td className="px-4 py-3 text-muted">{formatRelativeTime(new Date(org.createdAt))}</td>
                    <td className="px-4 py-3 text-muted">{formatRelativeTime(new Date(org.lastActivity))}</td>
                    <td className="relative px-4 py-3">
                      <button type="button" onClick={() => setActionMenu(actionMenu === org.id ? null : org.id)}
                        className="rounded-lg p-1.5 hover:bg-glass-hover">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {actionMenu === org.id && (
                        <div className="absolute right-4 z-10 mt-1 w-44 rounded-xl border border-border bg-surface py-1 shadow-xl">
                          <Link href={`/super-admin/organizations/${org.id}`} className="block px-3 py-2 text-sm hover:bg-glass">View</Link>
                          <Link href={`/super-admin/organizations/${org.id}?tab=settings`} className="block px-3 py-2 text-sm hover:bg-glass">Edit</Link>
                          {org.status !== "ACTIVE" && (
                            <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-glass"
                              onClick={() => { setConfirm({ kind: "status", id: org.id, name: org.name, status: "ACTIVE" }); setActionMenu(null); }}>
                              Activate
                            </button>
                          )}
                          {org.status === "ACTIVE" && (
                            <button type="button" className="block w-full px-3 py-2 text-left text-sm text-amber-400 hover:bg-glass"
                              onClick={() => { setConfirm({ kind: "status", id: org.id, name: org.name, status: "SUSPENDED" }); setActionMenu(null); }}>
                              Suspend
                            </button>
                          )}
                          <Link href={`/super-admin/organizations/${org.id}/admins/new`} className="block px-3 py-2 text-sm hover:bg-glass">Create Admin</Link>
                          <button type="button" className="block w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-glass"
                            onClick={() => { setConfirm({ kind: "delete", id: org.id, name: org.name }); setActionMenu(null); }}>
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-border px-3 py-1 text-sm disabled:opacity-40">Previous</button>
          <span className="px-3 py-1 text-sm text-muted">Page {page} of {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-border px-3 py-1 text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6">
            <h3 className="text-lg font-semibold">
              {confirm.kind === "delete" ? "Delete Organization?" : confirm.status === "SUSPENDED" ? "Suspend Organization?" : "Activate Organization?"}
            </h3>
            <p className="mt-2 text-sm text-muted">
              {confirm.kind === "delete"
                ? `This will archive ${confirm.name}. Organization data and accounts may be affected. Type the organization name to confirm.`
                : `Are you sure you want to change the status of ${confirm.name}?`}
            </p>
            {confirm.kind === "delete" && (
              <input value={confirmInput} onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={confirm.name}
                className="mt-4 w-full rounded-xl border border-border bg-glass px-4 py-2.5 text-sm" />
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => { setConfirm(null); setConfirmInput(""); }}
                className="rounded-full border border-border px-4 py-2 text-sm">Cancel</button>
              <button type="button" disabled={actionLoading || (confirm.kind === "delete" && confirmInput !== confirm.name)}
                onClick={performConfirm}
                className="rounded-full bg-red-500/90 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                {actionLoading ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </SuperAdminShell>
  );
}
