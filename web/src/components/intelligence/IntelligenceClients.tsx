"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, Shield } from "lucide-react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";
import { StaffShell } from "@/components/staff/StaffShell";
import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";
import { cn } from "@/lib/utils";

function useShell(user: SafeUser) {
  return user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? AdminShell : StaffShell;
}

function StatusBanner({ message, toolsOnly }: { message?: string; toolsOnly?: boolean }) {
  if (!toolsOnly && !message) return null;
  return (
    <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-100">
      {message ?? "No external AI provider configured — figures below come from live organization data tools."}
    </div>
  );
}

function useAiStatus() {
  const [banner, setBanner] = useState<{ toolsOnly: boolean; message: string } | null>(null);
  useEffect(() => {
    fetch("/api/intelligence/status", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return;
        const toolsOnly = !d.status?.available || d.status.provider === "NONE" || d.status.effectiveMode === "tools";
        setBanner({ toolsOnly, message: d.status?.message ?? "" });
      })
      .catch(() => undefined);
  }, []);
  return banner;
}

export function DailyBriefingClient({ user }: { user: SafeUser }) {
  const Shell = useShell(user);
  const banner = useAiStatus();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/intelligence/briefing/daily", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) setError(json.error ?? "Failed to load");
      else setData(json.briefing);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Shell user={user}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Daily Safety Briefing</h1>
          <p className="mt-1 text-sm text-muted">Generated from current organization-scoped system data.</p>
        </div>
        <button type="button" onClick={load} className="rounded-full border border-border p-2 text-muted hover:text-foreground">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      {banner?.toolsOnly && <div className="mt-4"><StatusBanner toolsOnly message={banner.message} /></div>}
      {loading ? (
        <Loader2 className="mt-12 h-8 w-8 animate-spin text-accent" />
      ) : error ? (
        <p className="mt-8 text-red-400">{error}</p>
      ) : data ? (
        <div className="mt-8 space-y-6">
          <p className="text-lg font-medium">{String(data.greeting)}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Overall Safety", value: `${data.overallSafety}/100` },
              { label: "Critical Alerts", value: data.criticalAlerts },
              { label: "Open Incidents", value: data.openIncidents },
              { label: "Offline Cameras", value: data.offlineCameras },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-surface/50 p-4">
                <p className="text-xs text-muted">{s.label}</p>
                <p className="mt-1 text-2xl font-bold">{String(s.value)}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-border bg-surface/50 p-6 space-y-3 text-sm">
            <p><span className="text-muted">Risk trend:</span> {String(data.riskTrend)}</p>
            <p><span className="text-muted">Highest risk note:</span> {String(data.highestRiskNote)}</p>
            <p><span className="text-muted">Recommended attention:</span> {String(data.recommendedAttention)}</p>
            <p className="text-xs text-muted">{String(data.disclaimer)} · Confidence: {String(data.confidence)} · As of {new Date(String(data.asOf)).toLocaleString()}</p>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}

export function ExecutiveSummaryClient({ user }: { user: SafeUser }) {
  const Shell = useShell(user);
  const banner = useAiStatus();
  const [range, setRange] = useState<"today" | "week" | "month">("week");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/intelligence/briefing/executive?range=${range}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) setError(json.error ?? "Failed to load");
      else setData(json.summary);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const recs = (data?.recommendedActions as Array<Record<string, string>>) ?? [];

  return (
    <Shell user={user}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Executive Summary</h1>
          <p className="mt-1 text-sm text-muted">Leadership view of safety posture for the selected range.</p>
        </div>
        <div className="flex gap-2">
          {(["today", "week", "month"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn("rounded-full px-3 py-1.5 text-xs capitalize", range === r ? "bg-accent/15 text-accent" : "border border-border text-muted")}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      {banner?.toolsOnly && <div className="mt-4"><StatusBanner toolsOnly message={banner.message} /></div>}
      {loading ? (
        <Loader2 className="mt-12 h-8 w-8 animate-spin text-accent" />
      ) : error ? (
        <p className="mt-8 text-red-400">{error}</p>
      ) : data ? (
        <div className="mt-8 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Safety Score", value: data.safetyScore },
              { label: "Incidents", value: data.criticalIncidents },
              { label: "Emergencies", value: data.emergencyEvents },
              { label: "Cameras Offline", value: data.cameraHealthOffline },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-surface/50 p-4">
                <p className="text-xs text-muted">{s.label}</p>
                <p className="mt-1 text-2xl font-bold">{String(s.value)}</p>
              </div>
            ))}
          </div>
          <p className="text-sm"><span className="text-muted">Risk trend:</span> {String(data.riskTrend)}</p>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Recommended actions</h2>
            <ul className="mt-3 space-y-2">
              {recs.map((r, i) => (
                <li key={i} className="rounded-xl border border-border px-4 py-3 text-sm">
                  <span className="text-accent">{r.priority}</span> — {r.reason}
                  <p className="mt-1 text-xs text-muted">{r.evidence} · {r.suggestedAction}</p>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted">As of {new Date(String(data.asOf)).toLocaleString()}</p>
        </div>
      ) : null}
    </Shell>
  );
}

export function PredictiveRiskClient({ user }: { user: SafeUser }) {
  const Shell = useShell(user);
  const banner = useAiStatus();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/intelligence/risk", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) setError(json.error ?? "Failed");
      else setData(json.risk);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const factors = (data?.potentialFactors as string[]) ?? [];

  return (
    <Shell user={user}>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Shield className="h-6 w-6 text-accent" /> Predictive Risk</h1>
          <p className="mt-1 text-sm text-muted">Estimate from historical org patterns — not a guarantee of future incidents.</p>
        </div>
        <button type="button" onClick={load} className="rounded-full border border-border p-2 text-muted hover:text-foreground"><RefreshCw className="h-4 w-4" /></button>
      </div>
      {banner?.toolsOnly && <div className="mt-4"><StatusBanner toolsOnly message={banner.message} /></div>}
      {loading ? <Loader2 className="mt-12 h-8 w-8 animate-spin text-accent" /> : error ? <p className="mt-8 text-red-400">{error}</p> : data ? (
        <div className="mt-8 space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface/50 p-6">
              <p className="text-xs text-muted">Current risk</p>
              <p className="mt-2 text-4xl font-bold">{String(data.currentRisk)}<span className="text-lg text-muted">/100</span></p>
            </div>
            <div className="rounded-xl border border-border bg-surface/50 p-6">
              <p className="text-xs text-muted">Trend</p>
              <p className="mt-2 text-2xl font-bold">{String(data.trend)}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface/50 p-6">
              <p className="text-xs text-muted">Confidence</p>
              <p className="mt-2 text-2xl font-bold">{String(data.confidence)}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface/50 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Potential factors</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
              {factors.length === 0 ? <li className="text-muted">No elevated factors from available metrics.</li> : factors.map((f) => <li key={f}>{f}</li>)}
            </ul>
            <p className="mt-4 text-xs text-muted">{String(data.disclaimer)}</p>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}

export function RecommendationsClient({ user }: { user: SafeUser }) {
  const Shell = useShell(user);
  const banner = useAiStatus();
  const [recs, setRecs] = useState<Array<Record<string, string>>>([]);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/intelligence/recommendations", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) setError(d.error);
        else {
          setRecs(d.recommendations ?? []);
          setAsOf(d.asOf);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Shell user={user}>
      <h1 className="text-2xl font-bold">Recommendations</h1>
      <p className="mt-1 text-sm text-muted">Derived from live organization metrics.</p>
      {banner?.toolsOnly && <div className="mt-4"><StatusBanner toolsOnly message={banner.message} /></div>}
      {loading ? <Loader2 className="mt-12 h-8 w-8 animate-spin text-accent" /> : error ? <p className="mt-8 text-red-400">{error}</p> : (
        <ul className="mt-8 space-y-3">
          {recs.map((r, i) => (
            <li key={i} className="rounded-2xl border border-border bg-surface/50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">{r.priority}</p>
              <p className="mt-2 text-sm font-medium">{r.reason}</p>
              <p className="mt-1 text-xs text-muted">Evidence: {r.evidence}</p>
              <p className="mt-1 text-xs">Suggested: {r.suggestedAction}</p>
            </li>
          ))}
          {asOf && <p className="text-xs text-muted">As of {new Date(asOf).toLocaleString()}</p>}
        </ul>
      )}
    </Shell>
  );
}

export function KnowledgeAdminClient({ user }: { user: SafeUser }) {
  const [docs, setDocs] = useState<Array<Record<string, unknown>>>([]);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("POLICY");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/intelligence/knowledge", { credentials: "include" });
    const data = await res.json();
    if (res.ok) setDocs(data.documents ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createDoc() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/intelligence/knowledge", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, type, text, status }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Failed");
      else {
        setTitle("");
        setText("");
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function setDocStatus(documentId: string, next: "PUBLISHED" | "ARCHIVED" | "DRAFT") {
    await fetch("/api/intelligence/knowledge", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId, status: next }),
    });
    await load();
  }

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Knowledge Base</h1>
      <p className="mt-1 text-sm text-muted">Upload text/markdown policies. Only published docs are searchable by Copilot.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface/50 p-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Add document</h2>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-sm" />
          <input value={type} onChange={(e) => setType(e.target.value)} placeholder="Type" className="w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-sm" />
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} placeholder="Markdown / plain text…" className="w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-sm font-mono" />
          <select value={status} onChange={(e) => setStatus(e.target.value as "DRAFT" | "PUBLISHED")} className="rounded-lg border border-border bg-black/30 px-3 py-2 text-sm">
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button type="button" disabled={saving || !title.trim() || !text.trim()} onClick={createDoc} className="rounded-xl bg-accent/90 px-4 py-2 text-sm font-medium text-black disabled:opacity-40">
            {saving ? "Saving…" : "Create"}
          </button>
        </div>

        <div className="rounded-2xl border border-border bg-surface/50 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Documents</h2>
          <ul className="mt-4 space-y-2">
            {docs.length === 0 && <li className="text-xs text-muted">No documents yet.</li>}
            {docs.map((d) => (
              <li key={String(d.documentId)} className="rounded-xl border border-border px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{String(d.title)}</p>
                    <p className="text-[10px] text-muted">{String(d.type)} · {String(d.status)} · v{String(d.version)} · {String(d.chunkCount)} chunks</p>
                  </div>
                  <div className="flex gap-1">
                    {d.status !== "PUBLISHED" && (
                      <button type="button" onClick={() => setDocStatus(String(d.documentId), "PUBLISHED")} className="rounded-lg bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300">Publish</button>
                    )}
                    {d.status !== "ARCHIVED" && (
                      <button type="button" onClick={() => setDocStatus(String(d.documentId), "ARCHIVED")} className="rounded-lg bg-white/5 px-2 py-1 text-[10px] text-muted">Archive</button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AdminShell>
  );
}

export function PrivacyAdminClient({ user }: { user: SafeUser }) {
  const [privacy, setPrivacy] = useState<Record<string, boolean | number> | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/intelligence/privacy", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setPrivacy(d.privacy);
      });
  }, []);

  async function save() {
    if (!privacy) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/intelligence/privacy", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(privacy),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setPrivacy(data.privacy);
      setMessage("Saved.");
    } else setMessage(data.error ?? "Failed");
  }

  const flags: Array<{ key: string; label: string; hint: string }> = [
    { key: "aiEnabled", label: "AI enabled", hint: "Master switch for intelligence features" },
    { key: "copilotEnabled", label: "Copilot enabled", hint: "Allow conversational assistant" },
    { key: "knowledgeBaseEnabled", label: "Knowledge base", hint: "Allow RAG over published docs" },
    { key: "documentIndexingEnabled", label: "Document indexing", hint: "Chunk & embed on publish" },
    { key: "allowExternalProviders", label: "Allow external LLM providers", hint: "When off, tools-only mode even if keys exist" },
    { key: "redactionEnabled", label: "Redaction", hint: "Redact secrets/emails/phones in prompts" },
    { key: "trainingUsageAllowed", label: "Training usage allowed", hint: "Opt-in for provider training (default off)" },
  ];

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">AI Privacy Settings</h1>
      <p className="mt-1 text-sm text-muted">Organization-scoped controls. Organization id is never taken from the client body for isolation.</p>
      {!privacy ? (
        <Loader2 className="mt-12 h-8 w-8 animate-spin text-accent" />
      ) : (
        <div className="mt-8 max-w-xl space-y-4">
          {flags.map((f) => (
            <label key={f.key} className="flex items-start justify-between gap-4 rounded-xl border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium">{f.label}</p>
                <p className="text-xs text-muted">{f.hint}</p>
              </div>
              <input
                type="checkbox"
                checked={Boolean(privacy[f.key])}
                onChange={(e) => setPrivacy({ ...privacy, [f.key]: e.target.checked })}
                className="mt-1"
              />
            </label>
          ))}
          <label className="block rounded-xl border border-border px-4 py-3">
            <p className="text-sm font-medium">Conversation retention (days)</p>
            <input
              type="number"
              min={7}
              max={365}
              value={Number(privacy.conversationRetentionDays ?? 90)}
              onChange={(e) => setPrivacy({ ...privacy, conversationRetentionDays: Number(e.target.value) })}
              className="mt-2 w-32 rounded-lg border border-border bg-black/30 px-3 py-1.5 text-sm"
            />
          </label>
          <button type="button" onClick={save} disabled={saving} className="rounded-xl bg-accent/90 px-4 py-2 text-sm font-medium text-black disabled:opacity-40">
            {saving ? "Saving…" : "Save settings"}
          </button>
          {message && <p className="text-xs text-muted">{message}</p>}
        </div>
      )}
    </AdminShell>
  );
}

export function SuperAdminModelsClient({ user }: { user: SafeUser }) {
  const [models, setModels] = useState<Record<string, unknown> | null>(null);
  const [videoDeployments, setVideoDeployments] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/super-admin/ai/models", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setModels(d.models);
        setVideoDeployments(d.videoDeployments || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const transition = async (deploymentId: string, lifecycle: string) => {
    const res = await fetch("/api/super-admin/ai/video-models", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "transition", deploymentId, lifecycle }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Updated to ${lifecycle}` : data.error || "Failed");
    const refreshed = await fetch("/api/super-admin/ai/models", { credentials: "include" }).then((r) =>
      r.json()
    );
    setVideoDeployments(refreshed.videoDeployments || []);
  };

  const env = (models?.env as Record<string, string | null>) ?? {};

  return (
    <SuperAdminShell user={user}>
      <h1 className="text-2xl font-bold">AI Models</h1>
      <p className="mt-1 text-muted">Configured provider status (secrets never exposed).</p>
      {msg && <p className="mt-2 text-xs text-sky-300">{msg}</p>}
      {loading ? <Loader2 className="mt-12 h-8 w-8 animate-spin text-accent" /> : models ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[
            { label: "Provider", value: String(models.configuredProvider) },
            { label: "Available", value: models.available ? "Yes" : "No" },
            { label: "Mode", value: String(models.mode) },
            { label: "Model", value: String(models.model) },
            { label: "Base URL", value: models.baseUrlConfigured ? "Configured" : "Default / unset" },
            { label: "API Key", value: models.keyConfigured ? "Configured" : "Not set" },
          ].map((row) => (
            <div key={row.label} className="gradient-border rounded-2xl bg-surface/60 p-5">
              <p className="text-xs text-muted">{row.label}</p>
              <p className="mt-2 text-lg font-semibold">{row.value}</p>
            </div>
          ))}
          <div className="sm:col-span-2 rounded-2xl border border-border bg-surface/50 p-5">
            <p className="text-xs text-muted mb-2">{String(models.message)}</p>
            <pre className="text-[11px] text-muted overflow-x-auto">{JSON.stringify(env, null, 2)}</pre>
          </div>
        </div>
      ) : null}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Video / CV model deployments</h2>
        <p className="mt-1 text-xs text-muted">
          Lifecycle: DRAFT → TESTING → APPROVED → DEPLOYED. Never skip evaluation. Rollback is audited.
        </p>
        <ul className="mt-4 space-y-2 text-xs">
          {videoDeployments.map((d) => (
            <li
              key={String(d.deploymentId)}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2"
            >
              <span>
                {String(d.modelId)} v{String(d.version)} · {String(d.lifecycle)}
                {d.purpose ? ` · ${String(d.purpose)}` : ""}
              </span>
              <span className="flex gap-1">
                {["TESTING", "APPROVED", "DEPLOYED", "DISABLED"].map((lc) => (
                  <button
                    key={lc}
                    type="button"
                    className="rounded border border-white/15 px-2 py-0.5"
                    onClick={() => transition(String(d.deploymentId), lc)}
                  >
                    {lc}
                  </button>
                ))}
              </span>
            </li>
          ))}
          {!videoDeployments.length && (
            <li className="text-muted">No CV deployments yet — create via POST /api/super-admin/ai/video-models</li>
          )}
        </ul>
      </section>
    </SuperAdminShell>
  );
}

export function SuperAdminObservabilityClient({ user }: { user: SafeUser }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/super-admin/ai/observability?days=30", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) setError(d.error);
        else setData(d);
      })
      .finally(() => setLoading(false));
  }, []);

  const totals = (data?.totals as Record<string, number>) ?? {};
  const byProvider = (data?.byProvider as Array<Record<string, unknown>>) ?? [];
  const recentErrors = (data?.recentErrors as Array<Record<string, unknown>>) ?? [];

  return (
    <SuperAdminShell user={user}>
      <h1 className="text-2xl font-bold">AI Observability</h1>
      <p className="mt-1 text-muted">Aggregated usage from AIUsageRecord (last {String(data?.rangeDays ?? 30)} days).</p>
      {loading ? <Loader2 className="mt-12 h-8 w-8 animate-spin text-accent" /> : error ? <p className="mt-8 text-red-400">{error}</p> : (
        <div className="mt-8 space-y-6">
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Requests", totals.requests],
              ["Success", totals.successCount],
              ["Failures", totals.failureCount],
              ["In tokens", totals.inputTokens],
              ["Out tokens", totals.outputTokens],
              ["Avg latency", `${totals.avgLatencyMs ?? 0}ms`],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-border bg-surface/50 p-4">
                <p className="text-[10px] uppercase text-muted">{label}</p>
                <p className="mt-1 text-xl font-bold">{String(value ?? 0)}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-border bg-surface/50 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">By provider</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {byProvider.length === 0 && <li className="text-muted">No usage recorded.</li>}
              {byProvider.map((p) => (
                <li key={String(p.provider)} className="flex justify-between border-b border-white/[0.04] py-2">
                  <span>{String(p.provider)}</span>
                  <span className="text-muted">{String(p.requests)} req · {String(p.failures)} fail · {String(p.avgLatencyMs)}ms</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-surface/50 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Recent errors</h2>
            <ul className="mt-3 space-y-2 text-xs">
              {recentErrors.length === 0 && <li className="text-muted">No recent errors.</li>}
              {recentErrors.map((e, i) => (
                <li key={i} className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                  <p className="font-medium text-red-200">{String(e.provider)} / {String(e.model)}</p>
                  <p className="text-muted">{String(e.error)}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </SuperAdminShell>
  );
}

export function SuperAdminTestingClient({ user }: { user: SafeUser }) {
  const [organizationId, setOrganizationId] = useState("");
  const [message, setMessage] = useState("Give me a dashboard summary");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(echoOnly: boolean) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/super-admin/ai/testing", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(echoOnly ? { echoOnly: true } : { organizationId, message }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Failed");
      else setResult(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SuperAdminShell user={user}>
      <h1 className="text-2xl font-bold">AI Testing</h1>
      <p className="mt-1 text-muted">Echo provider status or run orchestrator against an organization.</p>
      <div className="mt-8 max-w-xl space-y-3">
        <input
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
          placeholder="Organization ObjectId"
          className="w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-sm font-mono"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <button type="button" onClick={() => run(true)} disabled={loading} className="rounded-xl border border-border px-4 py-2 text-sm text-muted hover:text-foreground">
            Status echo
          </button>
          <button type="button" onClick={() => run(false)} disabled={loading || !organizationId.trim()} className="rounded-xl bg-accent/90 px-4 py-2 text-sm font-medium text-black disabled:opacity-40">
            Run orchestrator
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {result && (
          <pre className="overflow-x-auto rounded-xl border border-border bg-black/40 p-4 text-[11px] text-muted">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
        <p className="text-xs text-muted">
          Tip: list orgs from <Link href="/super-admin/organizations" className="text-accent hover:underline">Organizations</Link>.
        </p>
      </div>
    </SuperAdminShell>
  );
}
