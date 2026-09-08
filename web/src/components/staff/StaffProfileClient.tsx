"use client";

import { useEffect, useState } from "react";
import { StaffShell } from "./StaffShell";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { inputClass } from "@/components/organizations/WizardUI";
import { formatRelativeTime } from "@/lib/utils/time";

export function StaffProfileClient({ user }: { user: SafeUser }) {
  const [profile, setProfile] = useState({ phone: "", address: "", emergencyContactName: "", emergencyContactPhone: "", photo: "" });
  const [meta, setMeta] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/staff/profile", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        setMeta(j);
        const p = j.user?.profile ?? {};
        setProfile({
          phone: p.phone ?? "",
          address: p.address ?? "",
          emergencyContactName: p.emergencyContactName ?? "",
          emergencyContactPhone: p.emergencyContactPhone ?? "",
          photo: p.photo ?? "",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/staff/profile", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personal: profile }),
    });
    setMsg(res.ok ? "Profile saved." : "Failed to save.");
    setSaving(false);
  };

  if (loading) return <StaffShell user={user}><div className="h-64 animate-pulse rounded-2xl bg-glass" /></StaffShell>;

  const u = meta.user as Record<string, unknown>;
  const prof = u?.professional as Record<string, string>;
  const org = meta.organization as Record<string, string>;

  return (
    <StaffShell user={user}>
      <h1 className="text-2xl font-bold">My Profile</h1>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface/50 p-6">
          <h2 className="font-semibold">Account</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div><dt className="text-muted">Name</dt><dd className="font-medium">{String(u.name)}</dd></div>
            <div><dt className="text-muted">Staff ID</dt><dd className="font-mono text-accent">{String(u.userId)}</dd></div>
            <div><dt className="text-muted">Department</dt><dd>{prof?.department ?? "—"}</dd></div>
            <div><dt className="text-muted">Position</dt><dd>{prof?.jobTitle ?? "—"}</dd></div>
            <div><dt className="text-muted">Organization</dt><dd>{org?.name ?? "—"}</dd></div>
            <div><dt className="text-muted">Status</dt><dd>{String(u.status)}</dd></div>
            <div><dt className="text-muted">Last Login</dt><dd>{u?.lastLogin ? formatRelativeTime(new Date(u.lastLogin as string)) : "—"}</dd></div>
            <div><dt className="text-muted">Last Active</dt><dd>{u?.lastActive ? formatRelativeTime(new Date(u.lastActive as string)) : "—"}</dd></div>
          </dl>
        </section>
        <section className="rounded-2xl border border-border bg-surface/50 p-6">
          <h2 className="font-semibold">Editable Contact Info</h2>
          <div className="mt-4 space-y-3">
            {(["phone", "address", "emergencyContactName", "emergencyContactPhone"] as const).map((field) => (
              <div key={field}>
                <label className="text-xs text-muted capitalize">{field.replace(/([A-Z])/g, " $1")}</label>
                <input className={inputClass + " mt-1"} value={profile[field]} onChange={(e) => setProfile({ ...profile, [field]: e.target.value })} />
              </div>
            ))}
            {msg && <p className="text-sm text-accent">{msg}</p>}
            <button type="button" disabled={saving} onClick={save} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-background disabled:opacity-70">{saving ? "Saving..." : "Save Changes"}</button>
          </div>
        </section>
      </div>
    </StaffShell>
  );
}
