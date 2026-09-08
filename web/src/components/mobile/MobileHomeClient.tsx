"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { MobileShell } from "@/components/mobile/MobileShell";
import { FIELD_STAFF_STATUSES } from "@/lib/mobile/constants";
import { saveOfflineDraft, listOfflineDrafts } from "@/components/mobile/offline-store";

type HomeData = {
  greeting?: string;
  summary?: Record<string, number | boolean>;
  myStatus?: string;
  tasks?: Array<Record<string, unknown>>;
  alerts?: Array<Record<string, unknown>>;
  incidents?: Array<Record<string, unknown>>;
  emergency?: Record<string, unknown> | null;
  quickActions?: Array<{ label: string; href: string }>;
  locationSharingEnabled?: boolean;
  locationMeta?: { lastUpdated: string; accuracyM: number | null; note: string | null } | null;
};

export function MobileHomeClient({ user }: { user: SafeUser }) {
  const [data, setData] = useState<HomeData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/mobile/me", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setData(json);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }, []);

  useEffect(() => {
    load();
    setPending(listOfflineDrafts().length);
  }, [load]);

  const setStatus = async (status: string) => {
    await fetch("/api/mobile/me", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  };

  const s = data?.summary || {};

  return (
    <MobileShell user={user} emergencyActive={Boolean(data?.emergency)} title="Home">
      {err && (
        <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {err}
          <button type="button" className="ml-2 underline" onClick={load}>
            Retry
          </button>
        </div>
      )}

      <p className="text-2xl font-semibold tracking-tight">{data?.greeting || "Welcome"}, {user.name.split(" ")[0]}</p>
      <p className="mt-1 text-sm text-white/60">Field operations</p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { label: "Tasks", value: s.tasks ?? "—" },
          { label: "Alerts", value: s.alerts ?? "—" },
          { label: "Incidents", value: s.assignedIncidents ?? "—" },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-glass p-3 text-center">
            <p className="text-xl font-semibold">{String(c.value)}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted">{c.label}</p>
          </div>
        ))}
      </div>

      {pending > 0 && (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {pending} draft(s) pending sync
        </p>
      )}

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">My status</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {FIELD_STAFF_STATUSES.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatus(st)}
              className={`min-h-11 rounded-xl border px-3 text-xs ${
                data?.myStatus === st
                  ? "border-sky-400/50 bg-sky-500/20 text-sky-100"
                  : "border-border text-foreground/70"
              }`}
            >
              {st.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Quick actions</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(data?.quickActions || []).map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex min-h-12 items-center justify-center rounded-xl border border-border bg-glass text-sm font-medium"
            >
              {a.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Assigned work</h2>
        {(data?.tasks || []).slice(0, 5).map((t) => (
          <Link
            key={String(t.id)}
            href={String(t.href)}
            className="block rounded-xl border border-border p-3 text-sm"
          >
            <p className="font-medium">{String(t.title)}</p>
            <p className="text-xs text-muted">
              {String(t.status)} · {String(t.priority)}
              {t.overdue ? " · Overdue" : ""}
              {t.demo ? " · DEMO DATA" : ""}
            </p>
          </Link>
        ))}
        {!data?.tasks?.length && <p className="text-sm text-white/40">No assigned tasks.</p>}
      </section>

      {data?.locationMeta && (
        <p className="mt-6 text-[11px] text-white/40">
          Location last updated {new Date(data.locationMeta.lastUpdated).toLocaleString()}
          {data.locationMeta.accuracyM != null ? ` · ±${Math.round(data.locationMeta.accuracyM)}m` : ""}
          {data.locationMeta.note ? ` · ${data.locationMeta.note}` : ""}
        </p>
      )}
    </MobileShell>
  );
}

export function MobileReportClient({ user }: { user: SafeUser }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("MEDIUM");
  const [type, setType] = useState("OTHER");
  const [location, setLocation] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (asDraft: boolean) => {
    setBusy(true);
    setMsg(null);
    const payload = {
      title: title || "Field incident",
      description,
      severity,
      type,
      building: location,
      clientDraftId: `draft_${Date.now()}`,
    };
    try {
      if (asDraft || !navigator.onLine) {
        saveOfflineDraft(payload);
        setMsg("Saved as DRAFT — Pending Sync");
        setBusy(false);
        return;
      }
      const res = await fetch("/api/mobile/incidents", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Submit failed");
      setMsg(`Submitted ${json.result?.incidentId || ""}`);
      setTitle("");
      setDescription("");
    } catch (e) {
      saveOfflineDraft(payload);
      setMsg(`Offline/error — saved as DRAFT. ${e instanceof Error ? e.message : ""}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <MobileShell user={user} title="Report Incident">
      <p className="text-sm text-white/60">Quick field report — minimal fields during emergencies.</p>
      <div className="mt-4 space-y-3">
        <label className="block text-xs text-muted">
          Type
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 w-full min-h-11 rounded-xl border border-border bg-black/40 px-3 text-sm"
          >
            {["OTHER", "SECURITY", "MEDICAL", "FIRE", "FACILITIES"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-muted">
          Severity
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="mt-1 w-full min-h-11 rounded-xl border border-border bg-black/40 px-3 text-sm"
          >
            {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-muted">
          Location
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="mt-1 w-full min-h-11 rounded-xl border border-border bg-black/40 px-3 text-sm"
            placeholder="Building / area"
          />
        </label>
        <label className="block text-xs text-muted">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full min-h-11 rounded-xl border border-border bg-black/40 px-3 text-sm"
          />
        </label>
        <label className="block text-xs text-muted">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-xl border border-border bg-black/40 px-3 py-2 text-sm"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => submit(false)}
            className="min-h-12 flex-1 rounded-xl bg-sky-600 text-sm font-semibold"
          >
            Submit
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => submit(true)}
            className="min-h-12 flex-1 rounded-xl border border-white/15 text-sm"
          >
            Save Draft
          </button>
        </div>
        {msg && <p className="text-xs text-sky-200">{msg}</p>}
      </div>
    </MobileShell>
  );
}
