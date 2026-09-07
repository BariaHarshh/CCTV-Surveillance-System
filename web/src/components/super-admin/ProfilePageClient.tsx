"use client";

import { useState, FormEvent } from "react";
import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";
import { StatusBadge } from "@/components/super-admin/StatusBadge";
import { useAuth } from "@/components/auth/AuthProvider";
import type { SafeUser } from "@/lib/auth/sanitize-user";

export function ProfilePageClient({ user }: { user: SafeUser }) {
  const { refreshUser } = useAuth();
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMessage, setPwMessage] = useState("");

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/super-admin/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage("Profile updated successfully.");
      await refreshUser();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwMessage("");
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPwMessage("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwMessage(err instanceof Error ? err.message : "Password change failed");
    }
  };

  return (
    <SuperAdminShell user={user}>
      <h1 className="text-2xl font-bold">My Profile</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="gradient-border rounded-2xl bg-surface/60 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-xl font-bold text-accent">
              {user.name.charAt(0)}
            </div>
            <div>
              <p className="text-lg font-semibold">{user.name}</p>
              <StatusBadge status={user.status} />
            </div>
          </div>
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Email</dt><dd>{user.email}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">User ID</dt><dd className="font-mono">{user.userId}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Role</dt><dd>SUPER ADMIN</dd></div>
          </dl>
        </div>

        <form onSubmit={saveProfile} className="gradient-border rounded-2xl bg-surface/60 p-6">
          <h2 className="font-semibold">Edit Profile</h2>
          <label className="mt-4 block text-sm">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-border bg-glass px-4 py-2.5 text-sm"
            />
          </label>
          {message && <p className="mt-3 text-sm text-accent">{message}</p>}
          <button
            type="submit"
            disabled={saving}
            className="mt-4 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-background disabled:opacity-70"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>

        <form onSubmit={changePassword} className="gradient-border rounded-2xl bg-surface/60 p-6 lg:col-span-2">
          <h2 className="font-semibold">Change Password</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <input
              type="password"
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="rounded-xl border border-border bg-glass px-4 py-2.5 text-sm"
            />
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="rounded-xl border border-border bg-glass px-4 py-2.5 text-sm"
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="rounded-xl border border-border bg-glass px-4 py-2.5 text-sm"
            />
          </div>
          {pwMessage && <p className="mt-3 text-sm text-accent">{pwMessage}</p>}
          <button type="submit" className="mt-4 rounded-full border border-border px-6 py-2.5 text-sm hover:bg-glass">
            Update Password
          </button>
        </form>
      </div>
    </SuperAdminShell>
  );
}
