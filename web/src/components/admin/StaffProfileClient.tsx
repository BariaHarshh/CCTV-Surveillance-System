"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "./AdminShell";
import { StatusBadge } from "@/components/super-admin/StatusBadge";
import { formatRelativeTime } from "@/lib/utils/time";
import type { SafeUser } from "@/lib/auth/sanitize-user";

export function StaffProfileClient({ user, staffId }: { user: SafeUser; staffId: string }) {
  const [staff, setStaff] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/staff/${staffId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setStaff(j.staff ?? null))
      .finally(() => setLoading(false));
  }, [staffId]);

  if (loading) {
    return (
      <AdminShell user={user}>
        <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-glass" />)}</div>
      </AdminShell>
    );
  }

  if (!staff) {
    return (
      <AdminShell user={user}>
        <p className="text-red-400">Staff member not found.</p>
        <Link href="/admin/staff" className="mt-4 inline-block text-accent">← Back to Staff</Link>
      </AdminShell>
    );
  }

  const profile = staff.profile as Record<string, string>;
  const professional = staff.professional as Record<string, string>;

  return (
    <AdminShell user={user}>
      <Link href="/admin/staff" className="text-sm text-muted hover:text-accent">← Back to Staff</Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{staff.name as string}</h1>
          <p className="font-mono text-sm text-accent">{staff.userId as string}</p>
        </div>
        <StatusBadge status={staff.status as string} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface/50 p-6">
          <h2 className="font-semibold">Profile</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div><dt className="text-muted">Email</dt><dd>{staff.email as string}</dd></div>
            <div><dt className="text-muted">Phone</dt><dd>{profile?.phone || "—"}</dd></div>
            <div><dt className="text-muted">Address</dt><dd>{profile?.address || "—"}</dd></div>
          </dl>
        </section>
        <section className="rounded-2xl border border-border bg-surface/50 p-6">
          <h2 className="font-semibold">Employment</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div><dt className="text-muted">Employee ID</dt><dd>{professional?.employeeId || "—"}</dd></div>
            <div><dt className="text-muted">Department</dt><dd>{professional?.department || "—"}</dd></div>
            <div><dt className="text-muted">Position</dt><dd>{professional?.jobTitle || "—"}</dd></div>
            <div><dt className="text-muted">Joining Date</dt><dd>{professional?.joiningDate || "—"}</dd></div>
          </dl>
        </section>
        <section className="rounded-2xl border border-border bg-surface/50 p-6">
          <h2 className="font-semibold">Account</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div><dt className="text-muted">Staff ID</dt><dd className="font-mono">{staff.userId as string}</dd></div>
            <div><dt className="text-muted">Role</dt><dd>{staff.role as string}</dd></div>
            <div><dt className="text-muted">Status</dt><dd>{staff.status as string}</dd></div>
          </dl>
        </section>
        <section className="rounded-2xl border border-border bg-surface/50 p-6">
          <h2 className="font-semibold">Activity & Security</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div><dt className="text-muted">Last Login</dt><dd>{staff.lastLogin ? formatRelativeTime(new Date(staff.lastLogin as string)) : "Never"}</dd></div>
            <div><dt className="text-muted">Last Active</dt><dd>{staff.lastActive ? formatRelativeTime(new Date(staff.lastActive as string)) : "—"}</dd></div>
            <div><dt className="text-muted">Created</dt><dd>{formatRelativeTime(new Date(staff.createdAt as string))}</dd></div>
            <div><dt className="text-muted">Failed Login Attempts</dt><dd>{String(staff.failedLoginAttempts ?? 0)}</dd></div>
          </dl>
        </section>
      </div>
    </AdminShell>
  );
}
