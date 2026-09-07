"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import type { SafeUser } from "@/lib/auth/sanitize-user";

export function ProfileClient({ user }: { user: SafeUser }) {
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/organization", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setOrgName(j.organization?.basicInformation?.name ?? ""))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">My Profile</h1>
      <p className="mt-1 text-sm text-muted">Account information and security shortcuts</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface/50 p-6">
          <h2 className="font-semibold">Account</h2>
          {loading ? (
            <div className="mt-4 h-24 animate-pulse rounded-xl bg-glass" />
          ) : (
            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="text-muted">Name</dt>
                <dd className="font-medium">{user.name}</dd>
              </div>
              <div>
                <dt className="text-muted">Email</dt>
                <dd>{user.email}</dd>
              </div>
              <div>
                <dt className="text-muted">User ID</dt>
                <dd className="font-mono text-accent">{user.userId}</dd>
              </div>
              <div>
                <dt className="text-muted">Role</dt>
                <dd>{user.role}</dd>
              </div>
              <div>
                <dt className="text-muted">Status</dt>
                <dd>{user.status}</dd>
              </div>
              {orgName && (
                <div>
                  <dt className="text-muted">Organization</dt>
                  <dd>{orgName}</dd>
                </div>
              )}
            </dl>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-surface/50 p-6">
          <h2 className="font-semibold">Security</h2>
          <p className="mt-2 text-sm text-muted">Manage password, MFA, and active sessions.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/change-password" className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-black">
              Change password
            </Link>
            <Link href="/settings/security/mfa" className="rounded-xl border border-border px-4 py-2 text-sm hover:border-accent/40">
              MFA settings
            </Link>
            <Link href="/settings/sessions" className="rounded-xl border border-border px-4 py-2 text-sm hover:border-accent/40">
              Active sessions
            </Link>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
