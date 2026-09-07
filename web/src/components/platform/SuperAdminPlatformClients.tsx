"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";
import type { SafeUser } from "@/lib/auth/sanitize-user";

export function FeatureFlagsClient({ user }: { user: SafeUser }) {
  const [flags, setFlags] = useState<
    Array<{ id: string; key: string; enabled: boolean; rolloutPercentage: number }>
  >([]);
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/super-admin/feature-flags", { credentials: "include" });
    const j = await res.json();
    setFlags(j.flags ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function upsert(flagKey: string, enabled: boolean) {
    await fetch("/api/super-admin/feature-flags", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: flagKey, enabled }),
    });
    await load();
  }

  return (
    <SuperAdminShell user={user}>
      <h1 className="text-2xl font-bold">Feature flags</h1>
      <p className="mt-1 text-muted">Toggle platform capabilities by key</p>
      <div className="mt-6 flex gap-2">
        <input
          className="rounded-xl border border-border bg-surface/50 px-3 py-2 text-sm"
          placeholder="flag.key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <button
          type="button"
          onClick={() => key && upsert(key, true)}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-black"
        >
          Create / enable
        </button>
      </div>
      {loading ? (
        <Loader2 className="mt-8 h-8 w-8 animate-spin text-accent" />
      ) : (
        <ul className="mt-6 space-y-2">
          {flags.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between rounded-2xl border border-border bg-surface/40 px-4 py-3"
            >
              <div>
                <div className="font-mono text-sm">{f.key}</div>
                <div className="text-xs text-muted">Rollout {f.rolloutPercentage}%</div>
              </div>
              <button
                type="button"
                onClick={() => upsert(f.key, !f.enabled)}
                className={`rounded-lg px-3 py-1 text-xs ${
                  f.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-muted"
                }`}
              >
                {f.enabled ? "ON" : "OFF"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </SuperAdminShell>
  );
}

export function AnnouncementsClient({ user }: { user: SafeUser }) {
  const [items, setItems] = useState<
    Array<{ id: string; announcementId: string; title: string; type: string; active: boolean }>
  >([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/super-admin/announcements", { credentials: "include" });
    const j = await res.json();
    setItems(j.announcements ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    await fetch("/api/super-admin/announcements", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "IMPORTANT_NOTICE", title, message }),
    });
    setTitle("");
    setMessage("");
    await load();
  }

  return (
    <SuperAdminShell user={user}>
      <h1 className="text-2xl font-bold">Announcements</h1>
      <p className="mt-1 text-muted">Broadcast notices to organizations</p>
      <section className="mt-6 space-y-2 rounded-2xl border border-border bg-surface/50 p-4">
        <input
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          placeholder="Message"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button
          type="button"
          onClick={create}
          disabled={!title || !message}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          Publish
        </button>
      </section>
      {loading ? (
        <Loader2 className="mt-8 h-8 w-8 animate-spin text-accent" />
      ) : (
        <ul className="mt-6 space-y-2">
          {items.map((a) => (
            <li key={a.id} className="rounded-2xl border border-border bg-surface/40 px-4 py-3">
              <div className="text-xs text-muted">
                {a.announcementId} · {a.type}
              </div>
              <div className="font-medium">{a.title}</div>
            </li>
          ))}
        </ul>
      )}
    </SuperAdminShell>
  );
}

export function MaintenanceClient({ user }: { user: SafeUser }) {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/super-admin/maintenance", { credentials: "include" });
    const j = await res.json();
    setEnabled(Boolean(j.maintenance?.enabled));
    setMessage(j.maintenance?.message ?? "");
    setWarning(j.warning ?? null);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(next: boolean) {
    const res = await fetch("/api/super-admin/maintenance", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next, message }),
    });
    const j = await res.json();
    setEnabled(Boolean(j.maintenance?.enabled));
    setWarning(j.warning ?? null);
  }

  return (
    <SuperAdminShell user={user}>
      <h1 className="text-2xl font-bold">Maintenance mode</h1>
      <p className="mt-1 text-muted">Control platform-wide maintenance banner</p>
      {loading ? (
        <Loader2 className="mt-8 h-8 w-8 animate-spin text-accent" />
      ) : (
        <section className="mt-8 space-y-4 rounded-2xl border border-border bg-surface/50 p-6">
          {warning && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {warning}
            </p>
          )}
          <textarea
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => save(true)}
              className="rounded-xl border border-amber-500/40 px-4 py-2 text-sm text-amber-200"
            >
              Enable
            </button>
            <button
              type="button"
              onClick={() => save(false)}
              className="rounded-xl border border-border px-4 py-2 text-sm"
            >
              Disable
            </button>
            <span className="self-center text-sm text-muted">
              Currently: {enabled ? "ON" : "OFF"}
            </span>
          </div>
        </section>
      )}
    </SuperAdminShell>
  );
}

export function PlatformIncidentsClient({ user }: { user: SafeUser }) {
  const [items, setItems] = useState<
    Array<{ id: string; incidentId: string; severity: string; type: string; status: string; description: string }>
  >([]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/super-admin/platform-incidents", { credentials: "include" });
    const j = await res.json();
    setItems(j.incidents ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    await fetch("/api/super-admin/platform-incidents", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        severity: "HIGH",
        type: "SERVICE_OUTAGE",
        description,
      }),
    });
    setDescription("");
    await load();
  }

  return (
    <SuperAdminShell user={user}>
      <h1 className="text-2xl font-bold">Security incidents</h1>
      <p className="mt-1 text-muted">Platform-level incident tracking</p>
      <section className="mt-6 flex gap-2">
        <input
          className="flex-1 rounded-xl border border-border bg-surface/50 px-3 py-2 text-sm"
          placeholder="Describe incident"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button
          type="button"
          onClick={create}
          disabled={!description}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          Record
        </button>
      </section>
      {loading ? (
        <Loader2 className="mt-8 h-8 w-8 animate-spin text-accent" />
      ) : (
        <ul className="mt-6 space-y-2">
          {items.map((i) => (
            <li key={i.id} className="rounded-2xl border border-border bg-surface/40 px-4 py-3">
              <div className="text-xs text-muted">
                {i.incidentId} · {i.severity} · {i.status}
              </div>
              <div className="mt-1 text-sm">{i.description}</div>
            </li>
          ))}
        </ul>
      )}
    </SuperAdminShell>
  );
}

export function BackupsClient({ user }: { user: SafeUser }) {
  const [items, setItems] = useState<
    Array<{ id: string; backupId: string; type: string; status: string; completedAt: string | null }>
  >([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/super-admin/backups", { credentials: "include" });
    const j = await res.json();
    setItems(j.backups ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    const res = await fetch("/api/super-admin/backups", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "FULL" }),
    });
    const j = await res.json();
    setNote(j.backup?.note ?? "");
    await load();
  }

  return (
    <SuperAdminShell user={user}>
      <h1 className="text-2xl font-bold">Backups</h1>
      <p className="mt-1 text-muted">Backup job records — restore requires approval</p>
      <button
        type="button"
        onClick={create}
        className="mt-6 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-black"
      >
        Create backup job
      </button>
      {note && <p className="mt-3 text-sm text-muted">{note}</p>}
      {loading ? (
        <Loader2 className="mt-8 h-8 w-8 animate-spin text-accent" />
      ) : (
        <ul className="mt-6 space-y-2">
          {items.map((b) => (
            <li key={b.id} className="rounded-2xl border border-border bg-surface/40 px-4 py-3">
              <div className="font-mono text-sm">{b.backupId}</div>
              <div className="text-xs text-muted">
                {b.type} · {b.status}
                {b.completedAt ? ` · ${new Date(b.completedAt).toLocaleString()}` : ""}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SuperAdminShell>
  );
}
