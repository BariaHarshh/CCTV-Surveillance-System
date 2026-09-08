"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "./AdminShell";
import type { SafeUser } from "@/lib/auth/sanitize-user";

export function OrganizationProfileClient({ user }: { user: SafeUser }) {
  const [org, setOrg] = useState<Record<string, unknown> | null>(null);
  const canEdit = user.permissions?.includes("org:edit") ?? false;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/organization", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setOrg(j.organization ?? null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AdminShell user={user}>
        <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-glass" />)}</div>
      </AdminShell>
    );
  }

  if (!org) {
    return <AdminShell user={user}><p className="text-red-400">Organization not found.</p></AdminShell>;
  }

  const basic = org.basicInformation as Record<string, string>;
  const location = org.locationDetails as Record<string, string>;
  const campus = org.campus as Record<string, string | number>;
  const purpose = org.purpose as { useCases?: string[]; description?: string; safetyPriorities?: string[] };

  return (
    <AdminShell user={user} organizationName={org.name as string} organizationStatus={org.status as string}>
      <h1 className="text-2xl font-bold">Organization Profile</h1>
      <p className="mt-1 text-muted">{org.name as string} · {org.organizationId as string}</p>
      {!canEdit && (
        <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
          You don&apos;t have permission to modify organization information.
        </p>
      )}

      <div className="mt-8 space-y-6">
        <section className="rounded-2xl border border-border bg-surface/50 p-6">
          <h2 className="font-semibold">Organization</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">Organization Name</dt><dd className="font-medium">{basic?.name}</dd></div>
            <div><dt className="text-muted">Legal Name</dt><dd>{basic?.legalName || "—"}</dd></div>
            <div><dt className="text-muted">Organization ID</dt><dd className="font-mono text-accent">{org.organizationId as string}</dd></div>
            <div><dt className="text-muted">Type</dt><dd>{basic?.type}</dd></div>
            <div><dt className="text-muted">Website</dt><dd>{basic?.website || "—"}</dd></div>
            <div><dt className="text-muted">Email</dt><dd>{basic?.email}</dd></div>
            <div><dt className="text-muted">Phone</dt><dd>{basic?.phone || "—"}</dd></div>
          </dl>
        </section>

        <section className="rounded-2xl border border-border bg-surface/50 p-6">
          <h2 className="font-semibold">Location</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">Country</dt><dd>{location?.country}</dd></div>
            <div><dt className="text-muted">State</dt><dd>{location?.state}</dd></div>
            <div><dt className="text-muted">City</dt><dd>{location?.city}</dd></div>
            <div><dt className="text-muted">Address</dt><dd>{location?.address || "—"}</dd></div>
            <div><dt className="text-muted">Postal Code</dt><dd>{location?.postalCode || "—"}</dd></div>
          </dl>
        </section>

        <section className="rounded-2xl border border-border bg-surface/50 p-6">
          <h2 className="font-semibold">Campus</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-muted">Campus Name</dt><dd>{campus?.name as string}</dd></div>
            <div><dt className="text-muted">Buildings</dt><dd>{campus?.buildings as number}</dd></div>
            <div><dt className="text-muted">Classrooms</dt><dd>{campus?.classrooms as number}</dd></div>
            <div><dt className="text-muted">Laboratories</dt><dd>{campus?.laboratories as number}</dd></div>
            <div><dt className="text-muted">Cameras</dt><dd>{campus?.cameras as number}</dd></div>
            <div><dt className="text-muted">Students</dt><dd>{campus?.students as number}</dd></div>
            <div><dt className="text-muted">Faculty</dt><dd>{campus?.faculty as number}</dd></div>
            <div><dt className="text-muted">Security Personnel</dt><dd>{campus?.securityPersonnel as number}</dd></div>
          </dl>
        </section>

        <section className="rounded-2xl border border-border bg-surface/50 p-6">
          <h2 className="font-semibold">Purpose</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div><dt className="text-muted">Use Cases</dt><dd>{purpose?.useCases?.join(", ") || "—"}</dd></div>
            <div><dt className="text-muted">Safety Priorities</dt><dd>{purpose?.safetyPriorities?.join(", ") || "—"}</dd></div>
            <div><dt className="text-muted">Description</dt><dd>{purpose?.description || "—"}</dd></div>
          </dl>
        </section>
      </div>
    </AdminShell>
  );
}
