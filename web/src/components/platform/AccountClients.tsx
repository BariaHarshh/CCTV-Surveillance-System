"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import type { SafeUser } from "@/lib/auth/sanitize-user";

export function ProfileClient({ user }: { user: SafeUser }) {
  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">My profile</h1>
      <p className="mt-1 text-muted">Account details for {user.name}</p>
      <dl className="mt-8 grid gap-4 rounded-2xl border border-border bg-surface/50 p-6 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted">Name</dt>
          <dd className="font-medium">{user.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Email</dt>
          <dd>{user.email}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">User ID</dt>
          <dd className="font-mono text-sm text-accent">{user.userId}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Role</dt>
          <dd>{user.role}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Status</dt>
          <dd>{user.status}</dd>
        </div>
      </dl>
    </AdminShell>
  );
}

export function SessionsClient({ user }: { user: SafeUser }) {
  const [sessions, setSessions] = useState<
    Array<{ id: string; device: string; ipAddress: string; lastActive: string | null; isCurrent: boolean }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    // Prefer staff security endpoint when available; fall back gracefully for admins via org member sessions API
    const endpoints = ["/api/settings/sessions", "/api/staff/security"];
    for (const url of endpoints) {
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) {
        const j = await res.json();
        setSessions(j.sessions ?? []);
        setLoading(false);
        return;
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function logoutOthers() {
    const res = await fetch("/api/settings/sessions", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout_others" }),
    });
    if (!res.ok) {
      await fetch("/api/staff/security", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout_others" }),
      });
    }
    setMessage("Other sessions revoked.");
    await load();
  }

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Sessions</h1>
      <p className="mt-1 text-muted">Active sign-ins for your account</p>
      <button
        type="button"
        onClick={logoutOthers}
        className="mt-6 rounded-xl border border-border px-4 py-2 text-sm hover:border-accent/40"
      >
        Sign out other sessions
      </button>
      {message && <p className="mt-2 text-sm text-muted">{message}</p>}
      {loading ? (
        <Loader2 className="mt-8 h-8 w-8 animate-spin text-accent" />
      ) : (
        <ul className="mt-6 space-y-2">
          {sessions.map((s) => (
            <li key={s.id} className="rounded-2xl border border-border bg-surface/40 px-4 py-3">
              <div className="font-medium">
                {s.device}
                {s.isCurrent && <span className="ml-2 text-xs text-accent">Current</span>}
              </div>
              <div className="text-xs text-muted">
                {s.ipAddress}
                {s.lastActive ? ` · ${new Date(s.lastActive).toLocaleString()}` : ""}
              </div>
            </li>
          ))}
          {sessions.length === 0 && <p className="text-sm text-muted">No active sessions found.</p>}
        </ul>
      )}
    </AdminShell>
  );
}

export function NotificationPrefsClient({ user }: { user: SafeUser }) {
  const [channels, setChannels] = useState({
    inApp: true,
    email: true,
    push: false,
    sms: false,
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/settings/notifications/preferences", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j.preferences?.channels) setChannels(j.preferences.channels);
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    const res = await fetch("/api/settings/notifications/preferences", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channels }),
    });
    setMessage(res.ok ? "Preferences saved." : "Failed to save.");
  }

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Notification preferences</h1>
      <p className="mt-1 text-muted">Choose how you receive alerts</p>
      {loading ? (
        <Loader2 className="mt-8 h-8 w-8 animate-spin text-accent" />
      ) : (
        <section className="mt-8 space-y-3 rounded-2xl border border-border bg-surface/50 p-6">
          {(Object.keys(channels) as Array<keyof typeof channels>).map((key) => (
            <label key={key} className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={channels[key]}
                onChange={(e) => setChannels({ ...channels, [key]: e.target.checked })}
              />
              {key}
            </label>
          ))}
          <button
            type="button"
            onClick={save}
            className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-black"
          >
            Save
          </button>
          {message && <p className="text-sm text-muted">{message}</p>}
        </section>
      )}
    </AdminShell>
  );
}
