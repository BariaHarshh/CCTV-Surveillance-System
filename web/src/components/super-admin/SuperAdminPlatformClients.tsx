"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";
import { EmptyState } from "@/components/super-admin/EmptyState";
import type { SafeUser } from "@/lib/auth/sanitize-user";

type Flag = { id: string; key: string; enabled: boolean; environment: string; rolloutPercentage: number };

export function FeatureFlagsClient({ user }: { user: SafeUser }) {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const j = await fetch("/api/super-admin/feature-flags", { credentials: "include" }).then((r) => r.json());
    setFlags(j.flags ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(flag: Flag) {
    await fetch("/api/super-admin/feature-flags", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: flag.key, enabled: !flag.enabled, environment: flag.environment, rolloutPercentage: flag.rolloutPercentage }),
    });
    load();
  }

  async function create() {
    if (!key.trim()) return;
    setMsg("");
    const res = await fetch("/api/super-admin/feature-flags", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: key.trim(), enabled: false }),
    });
    if (res.ok) {
      setKey("");
      setMsg("Flag created.");
      load();
    }
  }

  return (
    <SuperAdminShell user={user}>
      <h1 className="text-2xl font-bold">Feature Flags</h1>
      <p className="mt-1 text-muted">Gradual rollout and environment toggles</p>

      <div className="mt-6 flex flex-wrap gap-2">
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="feature.key"
          className="min-w-[200px] flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
        <button type="button" onClick={create} className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-black">
          Add flag
        </button>
      </div>
      {msg && <p className="mt-2 text-sm text-muted">{msg}</p>}

      {loading ? (
        <Loader2 className="mt-12 h-8 w-8 animate-spin text-accent" />
      ) : flags.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No feature flags" description="Create a flag to control rollout." />
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {flags.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
              <div>
                <p className="font-mono text-sm">{f.key}</p>
                <p className="text-xs text-muted">
                  {f.environment} · {f.rolloutPercentage}% rollout
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggle(f)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${f.enabled ? "bg-accent/20 text-accent" : "border border-border text-muted"}`}
              >
                {f.enabled ? "Enabled" : "Disabled"}
              </button>
            </div>
          ))}
        </div>
      )}
    </SuperAdminShell>
  );
}

export function AnnouncementsClient({ user }: { user: SafeUser }) {
  const [items, setItems] = useState<Array<{ id: string; announcementId: string; type: string; title: string; message: string; active: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("IMPORTANT_NOTICE");

  const load = useCallback(async () => {
    const j = await fetch("/api/super-admin/announcements", { credentials: "include" }).then((r) => r.json());
    setItems(j.announcements ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/super-admin/announcements", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, message, type }),
    });
    setTitle("");
    setMessage("");
    load();
  }

  return (
    <SuperAdminShell user={user}>
      <h1 className="text-2xl font-bold">Announcements</h1>
      <p className="mt-1 text-muted">Platform-wide notices for organizations</p>

      <form onSubmit={create} className="mt-6 rounded-2xl border border-border bg-surface/50 p-6">
        <div className="grid gap-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="rounded-xl border border-border bg-background px-3 py-2 text-sm" required />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message" rows={3} className="rounded-xl border border-border bg-background px-3 py-2 text-sm" required />
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
            <option value="IMPORTANT_NOTICE">Important notice</option>
            <option value="NEW_FEATURE">New feature</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="SECURITY_NOTICE">Security notice</option>
          </select>
          <button type="submit" className="w-fit rounded-xl bg-accent px-4 py-2 text-sm font-medium text-black">
            Publish
          </button>
        </div>
      </form>

      {loading ? (
        <Loader2 className="mt-8 h-8 w-8 animate-spin text-accent" />
      ) : (
        <div className="mt-6 space-y-3">
          {items.map((a) => (
            <div key={a.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="font-mono">{a.announcementId}</span>
                <span>{a.type}</span>
                {a.active && <span className="text-accent">Active</span>}
              </div>
              <p className="mt-1 font-semibold">{a.title}</p>
              <p className="mt-1 text-sm text-muted">{a.message}</p>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-muted">No announcements yet.</p>}
        </div>
      )}
    </SuperAdminShell>
  );
}

export function MaintenanceClient({ user }: { user: SafeUser }) {
  const [data, setData] = useState<{ enabled: boolean; message: string; warnings: string[] } | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const j = await fetch("/api/super-admin/maintenance", { credentials: "include" }).then((r) => r.json());
    setData({ enabled: j.maintenance?.enabled ?? false, message: j.maintenance?.message ?? "", warnings: j.warnings ?? [] });
    setMessage(j.maintenance?.message ?? "");
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setEnabled(enabled: boolean) {
    await fetch("/api/super-admin/maintenance", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, message }),
    });
    load();
  }

  if (loading || !data) {
    return (
      <SuperAdminShell user={user}>
        <Loader2 className="mt-12 h-8 w-8 animate-spin text-accent" />
      </SuperAdminShell>
    );
  }

  return (
    <SuperAdminShell user={user}>
      <h1 className="text-2xl font-bold">Maintenance Mode</h1>
      <p className="mt-1 text-muted">Control platform availability during upgrades</p>

      {data.warnings.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          {data.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}

      <section className="mt-6 rounded-2xl border border-border bg-surface/50 p-6">
        <p className="text-sm">
          Status: <strong>{data.enabled ? "Enabled" : "Disabled"}</strong>
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Maintenance message shown to users"
          rows={3}
          className="mt-4 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => setEnabled(true)} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-black">
            Enable
          </button>
          <button type="button" onClick={() => setEnabled(false)} className="rounded-xl border border-border px-4 py-2 text-sm">
            Disable
          </button>
        </div>
      </section>
    </SuperAdminShell>
  );
}

export function BackupsClient({ user }: { user: SafeUser }) {
  const [backups, setBackups] = useState<Array<{ id: string; backupId: string; type: string; status: string; completedAt: string | null }>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const j = await fetch("/api/super-admin/backups", { credentials: "include" }).then((r) => r.json());
    setBackups(j.backups ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(type: string) {
    await fetch("/api/super-admin/backups", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    load();
  }

  return (
    <SuperAdminShell user={user}>
      <h1 className="text-2xl font-bold">Backups</h1>
      <p className="mt-1 text-muted">Backup jobs and restore workflow records</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {(["FULL", "DATABASE", "CONFIGURATION"] as const).map((t) => (
          <button key={t} type="button" onClick={() => create(t)} className="rounded-xl border border-border px-3 py-1.5 text-xs hover:border-accent/40">
            Run {t} backup
          </button>
        ))}
      </div>

      {loading ? (
        <Loader2 className="mt-8 h-8 w-8 animate-spin text-accent" />
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Backup</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Completed</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.id} className="border-b border-white/[0.04]">
                  <td className="px-4 py-3 font-mono">{b.backupId}</td>
                  <td className="px-4 py-3">{b.type}</td>
                  <td className="px-4 py-3">{b.status}</td>
                  <td className="px-4 py-3 text-muted">{b.completedAt ? new Date(b.completedAt).toLocaleString() : "—"}</td>
                </tr>
              ))}
              {backups.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    No backups recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </SuperAdminShell>
  );
}

export function PlatformIncidentsClient({ user }: { user: SafeUser }) {
  const [incidents, setIncidents] = useState<Array<{ id: string; incidentId: string; severity: string; type: string; status: string; description: string; detectedAt: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState("");
  const [type, setType] = useState("SERVICE_OUTAGE");
  const [severity, setSeverity] = useState("HIGH");

  const load = useCallback(async () => {
    const j = await fetch("/api/super-admin/platform-incidents", { credentials: "include" }).then((r) => r.json());
    setIncidents(j.incidents ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/super-admin/platform-incidents", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, type, severity }),
    });
    setDescription("");
    load();
  }

  return (
    <SuperAdminShell user={user}>
      <h1 className="text-2xl font-bold">Platform Incidents</h1>
      <p className="mt-1 text-muted">Track outages and security events affecting the platform</p>

      <form onSubmit={create} className="mt-6 rounded-2xl border border-border bg-surface/50 p-6">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Incident description" rows={2} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" required />
        <div className="mt-3 flex flex-wrap gap-2">
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
            <option value="SERVICE_OUTAGE">Service outage</option>
            <option value="AUTHENTICATION_ATTACK">Authentication attack</option>
            <option value="DATA_BREACH">Data breach</option>
            <option value="API_ABUSE">API abuse</option>
            <option value="OTHER">Other</option>
          </select>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
          <button type="submit" className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-black">
            Open incident
          </button>
        </div>
      </form>

      {loading ? (
        <Loader2 className="mt-8 h-8 w-8 animate-spin text-accent" />
      ) : (
        <div className="mt-6 space-y-3">
          {incidents.map((i) => (
            <div key={i.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap gap-2 text-xs text-muted">
                <span className="font-mono">{i.incidentId}</span>
                <span>{i.type}</span>
                <span>{i.severity}</span>
                <span>{i.status}</span>
              </div>
              <p className="mt-2 text-sm">{i.description}</p>
              <p className="mt-1 text-xs text-muted">{new Date(i.detectedAt).toLocaleString()}</p>
            </div>
          ))}
          {incidents.length === 0 && <p className="text-sm text-muted">No platform incidents.</p>}
        </div>
      )}
    </SuperAdminShell>
  );
}
