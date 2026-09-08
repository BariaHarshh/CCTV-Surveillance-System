"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import type { SafeUser } from "@/lib/auth/sanitize-user";

type Invitation = {
  id: string;
  invitationId: string;
  email: string;
  role: string;
  department: string;
  status: string;
  expiresAt: string;
  invitedByName: string;
  createdAt: string;
};

export function InvitationsClient({ user }: { user: SafeUser }) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "STAFF">("STAFF");
  const [department, setDepartment] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    const res = await fetch("/api/invitations", { credentials: "include" });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error ?? "Failed to load invitations.");
      setLoading(false);
      return;
    }
    setInvitations(j.invitations ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    setError("");
    setMsg("");
    const res = await fetch("/api/invitations", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), role, department: department.trim() || undefined }),
    });
    const j = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(j.error ?? "Failed to send invitation.");
      return;
    }
    setEmail("");
    setMsg(`Invitation sent to ${j.invitation?.email ?? email}`);
    await load();
  }

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">User Invitations</h1>
      <p className="mt-1 text-sm text-muted">Invite administrators and staff to your organization</p>

      <form onSubmit={invite} className="mt-8 rounded-2xl border border-border bg-surface/50 p-6">
        <h2 className="font-semibold">Send invitation</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block text-sm sm:col-span-2">
            <span className="text-muted">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
              placeholder="user@campus.edu"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "ADMIN" | "STAFF")}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
            >
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          <label className="block text-sm sm:col-span-3">
            <span className="text-muted">Department (optional)</span>
            <input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={saving || !email.trim()}
          className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          {saving ? "Sending…" : "Send invitation"}
        </button>
        {msg && <p className="mt-3 text-sm text-accent">{msg}</p>}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </form>

      {loading ? (
        <Loader2 className="mt-8 h-8 w-8 animate-spin text-accent" />
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Invited by</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => (
                <tr key={inv.id} className="border-b border-white/[0.04]">
                  <td className="px-4 py-3">
                    <div>{inv.email}</div>
                    <div className="font-mono text-xs text-muted">{inv.invitationId}</div>
                  </td>
                  <td className="px-4 py-3">{inv.role}</td>
                  <td className="px-4 py-3">{inv.status}</td>
                  <td className="px-4 py-3 text-muted">{new Date(inv.expiresAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-muted">{inv.invitedByName}</td>
                </tr>
              ))}
              {invitations.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    No invitations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
