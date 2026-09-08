"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Building2,
  RefreshCw,
  Shield,
  UserCheck,
  UserCog,
  Users,
  UserX,
  Wifi,
} from "lucide-react";
import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";
import { StatCard, StatCardSkeleton } from "@/components/super-admin/StatCard";
import { DonutChart } from "@/components/super-admin/DonutChart";
import { StatusBadge } from "@/components/super-admin/StatusBadge";
import { EmptyState } from "@/components/super-admin/EmptyState";
import { useDashboardData } from "@/components/super-admin/useDashboardData";
import { formatRelativeTime } from "@/lib/utils/time";
import type { SafeUser } from "@/lib/auth/sanitize-user";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function formatDate(): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

export function SuperAdminDashboard({ user }: { user: SafeUser }) {
  const { data, loading, error, refetch, notifications } = useDashboardData();

  const scrollToHealth = () => {
    document.getElementById("system-health")?.scrollIntoView({ behavior: "smooth" });
  };

  if (error && !data) {
    return (
      <SuperAdminShell user={user}>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-lg font-medium text-red-400">Unable to load platform statistics</p>
          <p className="mt-2 text-sm text-muted">{error}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-background"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      </SuperAdminShell>
    );
  }

  const stats = data?.statistics;

  return (
    <SuperAdminShell
      user={user}
      systemStatus={data?.systemHealth.overall ?? "degraded"}
      notifications={notifications}
      onStatusClick={scrollToHealth}
    >
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
              {getGreeting()}, Super Admin
            </h1>
            <p className="mt-1 text-muted">Platform overview and system activity</p>
          </div>
          <p className="text-sm text-muted">{formatDate()}</p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />)
            : stats && (
                <>
                  <StatCard label="Total Organizations" value={stats.organizations.total} icon={Building2} delay={0} />
                  <StatCard label="Total Admins" value={stats.users.admins} icon={UserCog} delay={0.05} />
                  <StatCard label="Total Staff" value={stats.users.staff} icon={Users} delay={0.1} />
                  <StatCard label="Total Users" value={stats.users.platformUsers} icon={Users} delay={0.15} />
                  <StatCard label="Active Users" value={stats.users.active} icon={UserCheck} delay={0.2} />
                  <StatCard label="Inactive Users" value={stats.users.inactive} icon={UserX} delay={0.25} />
                  <StatCard label="Suspended Users" value={stats.users.suspended} icon={Shield} delay={0.3} />
                  <StatCard label="Online Users" value={stats.users.online} icon={Wifi} delay={0.35} />
                </>
              )}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {loading ? (
            <>
              <div className="h-64 animate-pulse rounded-2xl bg-surface/40" />
              <div className="h-64 animate-pulse rounded-2xl bg-surface/40" />
            </>
          ) : (
            stats && (
              <>
                <DonutChart title="User Status" data={stats.userStatusChart} />
                <DonutChart title="Online vs Offline" data={stats.onlineChart} />
              </>
            )
          )}
        </div>

        {/* Organizations */}
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Organizations</h2>
            <Link href="/super-admin/organizations" className="text-sm text-accent hover:text-accent-dim">
              View all
            </Link>
          </div>
          {loading ? (
            <div className="mt-4 h-40 animate-pulse rounded-2xl bg-surface/40" />
          ) : data?.organizations.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon="building"
                title="No organizations yet"
                description="Create your first organization to begin building the AI Campus Guardian network."
                actionLabel="Create Organization"
                onAction={() => window.location.assign("/super-admin/organizations")}
              />
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-border bg-surface/60 text-xs tracking-wider text-muted uppercase">
                  <tr>
                    <th className="px-4 py-3">Organization</th>
                    <th className="px-4 py-3">Admins</th>
                    <th className="px-4 py-3">Staff</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.organizations.slice(0, 5).map((org) => (
                    <tr key={org.id} className="border-b border-white/[0.04] hover:bg-glass">
                      <td className="px-4 py-3 font-medium">{org.name}</td>
                      <td className="px-4 py-3">{org.admins}</td>
                      <td className="px-4 py-3">{org.staff}</td>
                      <td className="px-4 py-3"><StatusBadge status={org.status} /></td>
                      <td className="px-4 py-3 text-muted">{new Date(org.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <Link href={`/super-admin/organizations/${org.id}`} className="text-accent hover:underline">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Admins + Activity + Security + Health - condensed */}
        <div className="mt-10 grid gap-6 xl:grid-cols-2">
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Platform Administrators</h2>
              <Link href="/super-admin/administrators" className="text-sm text-accent">View all</Link>
            </div>
            {loading ? (
              <div className="mt-4 h-40 animate-pulse rounded-2xl bg-surface/40" />
            ) : data?.admins.length === 0 ? (
              <div className="mt-4">
              <EmptyState
                title="No administrators yet"
                description="Platform administrators will appear here once organizations and admin accounts are created."
                actionLabel="+ Create Admin"
                onAction={() => window.location.assign("/super-admin/administrators")}
              />
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-surface/60 text-xs text-muted uppercase">
                    <tr>
                      <th className="px-4 py-3">Admin</th>
                      <th className="px-4 py-3">Organization</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Last Login</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.admins.slice(0, 5).map((admin) => (
                      <tr key={admin.id} className="border-b border-white/[0.04]">
                        <td className="px-4 py-3">{admin.name}</td>
                        <td className="px-4 py-3 text-muted">{admin.organization}</td>
                        <td className="px-4 py-3"><StatusBadge status={admin.status} /></td>
                        <td className="px-4 py-3 text-muted">
                          {admin.lastLogin ? formatRelativeTime(new Date(admin.lastLogin)) : "Never"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <div className="mt-4 space-y-2">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-surface/40" />
                ))
              ) : data?.activity.length === 0 ? (
                <EmptyState title="No activity yet" description="Platform activity will appear here as events occur." />
              ) : (
                data?.activity.slice(0, 8).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 rounded-xl border border-border bg-surface/40 px-4 py-3"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.description}</p>
                      <p className="mt-1 text-xs text-muted">
                        {item.actor} · {formatRelativeTime(new Date(item.createdAt))}
                      </p>
                    </div>
                    {item.severity === "warning" && (
                      <span className="text-[10px] text-amber-400 uppercase">Alert</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <section className="gradient-border rounded-2xl bg-surface/60 p-6">
            <h2 className="text-lg font-semibold">Security Center</h2>
            {loading ? (
              <div className="mt-4 h-24 animate-pulse rounded-xl bg-glass" />
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted">Failed Logins Today</p>
                  <p className="mt-1 font-mono text-2xl">{stats?.security.failedLoginsToday ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Locked Accounts</p>
                  <p className="mt-1 font-mono text-2xl">{stats?.security.lockedAccounts ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Active Sessions</p>
                  <p className="mt-1 font-mono text-2xl">{stats?.security.activeSessions ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Security Events Today</p>
                  <p className="mt-1 font-mono text-2xl">{stats?.security.securityEventsToday ?? 0}</p>
                </div>
              </div>
            )}
            <Link
              href="/super-admin/security-center"
              className="mt-4 inline-block text-sm text-accent hover:text-accent-dim"
            >
              View Security Activity →
            </Link>
          </section>

          <section id="system-health" className="gradient-border rounded-2xl bg-surface/60 p-6">
            <h2 className="text-lg font-semibold">Platform Health</h2>
            {loading ? (
              <div className="mt-4 h-24 animate-pulse rounded-xl bg-glass" />
            ) : (
              <div className="mt-4 space-y-3">
                {[
                  { label: "Database", value: data?.systemHealth.database },
                  { label: "Authentication", value: data?.systemHealth.authentication },
                  { label: "API", value: data?.systemHealth.api },
                  { label: "Sessions", value: data?.systemHealth.sessions },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-sm text-muted">{item.label}</span>
                    <StatusBadge status={item.value === "connected" || item.value === "operational" ? "operational" : "degraded"} />
                  </div>
                ))}
              </div>
            )}
            <Link href="/super-admin/system-health" className="mt-4 inline-block text-sm text-accent">
              View details →
            </Link>
          </section>
        </div>
      </motion.div>
    </SuperAdminShell>
  );
}
