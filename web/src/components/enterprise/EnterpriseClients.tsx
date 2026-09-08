"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";
import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";

type Row = Record<string, unknown>;

function useJson<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(url));

  const reload = useCallback(() => {
    if (!url) return;
    setLoading(true);
    fetch(url, { credentials: "include" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Request failed");
        setData(j as T);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [url]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload };
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <>
      <h1 className="text-2xl font-bold">{title}</h1>
      {subtitle ? <p className="mt-1 text-muted">{subtitle}</p> : null}
      <div className="mt-6 space-y-4">{children}</div>
    </>
  );
}

function CardGrid({ items }: { items: Array<{ label: string; value: string | number }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((c) => (
        <div key={c.label} className="rounded-2xl border border-border bg-surface/50 p-4">
          <p className="text-xs uppercase tracking-wide text-muted">{c.label}</p>
          <p className="mt-2 text-2xl font-semibold">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase text-muted">
      {value}
    </span>
  );
}

/* ─── Admin: Automation ─── */
export function AutomationDashboardClient({ user }: { user: SafeUser }) {
  const { data, reload, error, loading } = useJson<{ automations: Row[] }>("/api/enterprise/automation");
  const dash = useJson<{ cards: Row }>("/api/enterprise/dashboard");
  const [name, setName] = useState("");

  async function create() {
    if (!name.trim()) return;
    await fetch("/api/enterprise/automation", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setName("");
    reload();
  }

  async function setStatus(id: string, status: string) {
    await fetch(`/api/enterprise/automation/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    reload();
  }

  const cards = dash.data?.cards as
    | {
        incidents?: number;
        alerts?: number;
        failedAutomations?: number;
        approvals?: number;
      }
    | undefined;

  return (
    <AdminShell user={user}>
      <Panel title="Automation" subtitle="Organization workflow automations (draft → publish).">
        {cards ? (
          <CardGrid
            items={[
              { label: "Open incidents", value: cards.incidents ?? 0 },
              { label: "Active alerts", value: cards.alerts ?? 0 },
              { label: "Pending approvals", value: cards.approvals ?? 0 },
              { label: "Failed automations", value: cards.failedAutomations ?? 0 },
            ]}
          />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/automation/templates" className="text-sm text-accent">
            Templates
          </Link>
          <Link href="/admin/automation/runs" className="text-sm text-accent">
            Runs
          </Link>
          <Link href="/admin/automation/sandbox" className="text-sm text-accent">
            Sandbox
          </Link>
        </div>
        <div className="flex flex-wrap gap-2 rounded-xl border border-border p-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Automation name"
            className="rounded-lg border border-border bg-black/20 px-3 py-2 text-sm"
          />
          <button type="button" onClick={create} className="rounded-lg bg-accent/20 px-4 py-2 text-sm text-accent">
            Create draft
          </button>
        </div>
        {loading ? <p className="text-sm text-muted">Loading…</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <div className="space-y-3">
          {(data?.automations ?? []).map((a) => (
            <div key={String(a.automationId)} className="rounded-2xl border border-border bg-surface/50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{String(a.name)}</h3>
                  <p className="text-xs text-muted">
                    {String(a.automationId)} · v{String(a.version)}
                  </p>
                </div>
                <StatusPill value={String(a.status)} />
              </div>
              <p className="mt-2 text-sm text-muted">{String(a.description || "—")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {["ACTIVE", "PAUSED", "DISABLED", "DRAFT"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(String(a.automationId), s)}
                    className="text-[10px] text-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </AdminShell>
  );
}

export function AutomationTemplatesClient({ user }: { user: SafeUser }) {
  const { data, reload } = useJson<{ templates: Row[] }>("/api/enterprise/automation/templates");

  async function install(templateKey: string) {
    await fetch("/api/enterprise/automation/templates", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateKey }),
    });
    reload();
  }

  return (
    <AdminShell user={user}>
      <Panel title="Automation templates" subtitle="Install a draft copy into your organization.">
        <div className="grid gap-4 lg:grid-cols-2">
          {(data?.templates ?? []).map((t) => (
            <div key={String(t.key)} className="rounded-2xl border border-border bg-surface/50 p-5">
              <h3 className="font-semibold">{String(t.name)}</h3>
              <p className="mt-1 text-sm text-muted">{String(t.description)}</p>
              <p className="mt-2 text-xs text-muted">Risk: {String(t.risk)}</p>
              <button
                type="button"
                onClick={() => install(String(t.key))}
                className="mt-3 rounded-lg bg-accent/20 px-3 py-1.5 text-sm text-accent"
              >
                Install draft
              </button>
            </div>
          ))}
        </div>
      </Panel>
    </AdminShell>
  );
}

export function AutomationRunsClient({ user }: { user: SafeUser }) {
  const { data } = useJson<{ runs: Row[] }>("/api/enterprise/automation/runs");
  const [selected, setSelected] = useState<Row | null>(null);

  async function openRun(runId: string) {
    const res = await fetch(`/api/enterprise/automation/runs/${runId}`, { credentials: "include" });
    const j = await res.json();
    setSelected(j.run ?? null);
  }

  return (
    <AdminShell user={user}>
      <Panel title="Automation runs" subtitle="Recent workflow executions for this organization.">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            {(data?.runs ?? []).map((r) => (
              <button
                key={String(r.runId)}
                type="button"
                onClick={() => openRun(String(r.runId))}
                className="block w-full rounded-xl border border-border bg-surface/50 p-3 text-left"
              >
                <div className="flex justify-between gap-2">
                  <span className="text-sm font-medium">{String(r.runId)}</span>
                  <StatusPill value={String(r.status)} />
                </div>
                <p className="mt-1 text-xs text-muted">
                  {String(r.automationId)} {r.dryRun ? "· dry-run" : ""}
                </p>
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-border bg-surface/50 p-4">
            <h3 className="font-semibold">Timeline</h3>
            {!selected ? <p className="mt-2 text-sm text-muted">Select a run</p> : null}
            <ul className="mt-3 space-y-2 text-sm">
              {(((selected?.steps as Row[]) ?? []) as Row[]).map((s, i) => (
                <li key={i} className="border-b border-white/5 pb-2">
                  <span className="text-xs text-muted">{String(s.status)}</span> {String(s.label)}
                  {s.detail ? <p className="text-xs text-muted">{String(s.detail)}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>
    </AdminShell>
  );
}

export function AutomationSandboxClient({ user }: { user: SafeUser }) {
  const autos = useJson<{ automations: Row[] }>("/api/enterprise/automation");
  const [automationId, setAutomationId] = useState("");
  const [contextJson, setContextJson] = useState('{"eventType":"ALERT_CREATED","severity":"HIGH"}');
  const [result, setResult] = useState<Row | null>(null);

  async function run() {
    let context: Row = {};
    try {
      context = JSON.parse(contextJson) as Row;
    } catch {
      setResult({ error: "Invalid JSON context" });
      return;
    }
    const res = await fetch("/api/enterprise/automation/sandbox", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ automationId, context }),
    });
    const j = await res.json();
    setResult(j);
  }

  return (
    <AdminShell user={user}>
      <Panel title="Automation sandbox" subtitle="Dry-run simulateAutomation — no live side effects.">
        <div className="space-y-3 rounded-xl border border-border p-4">
          <select
            value={automationId}
            onChange={(e) => setAutomationId(e.target.value)}
            className="w-full rounded-lg border border-border bg-black/20 px-3 py-2 text-sm"
          >
            <option value="">Select automation</option>
            {(autos.data?.automations ?? []).map((a) => (
              <option key={String(a.automationId)} value={String(a.automationId)}>
                {String(a.name)} ({String(a.status)})
              </option>
            ))}
          </select>
          <textarea
            value={contextJson}
            onChange={(e) => setContextJson(e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-border bg-black/20 px-3 py-2 font-mono text-xs"
          />
          <button
            type="button"
            onClick={run}
            disabled={!automationId}
            className="rounded-lg bg-accent/20 px-4 py-2 text-sm text-accent disabled:opacity-40"
          >
            Dry run
          </button>
        </div>
        {result ? (
          <pre className="overflow-auto rounded-xl border border-border bg-black/30 p-4 text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
        ) : null}
      </Panel>
    </AdminShell>
  );
}

/* ─── Policies ─── */
export function PoliciesClient({ user }: { user: SafeUser }) {
  const { data, reload } = useJson<{ policies: Row[] }>("/api/enterprise/policies");
  const [name, setName] = useState("");
  const [action, setAction] = useState("CREATE_ALERT");
  const [effect, setEffect] = useState("ALLOW");

  async function create() {
    if (!name.trim()) return;
    await fetch("/api/enterprise/policies", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, action, effect }),
    });
    setName("");
    reload();
  }

  return (
    <AdminShell user={user}>
      <Panel title="Policies" subtitle="Deterministic allow / deny / approval rules.">
        <Link href="/admin/policies/test" className="text-sm text-accent">
          Policy test console
        </Link>
        <div className="flex flex-wrap gap-2 rounded-xl border border-border p-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Policy name"
            className="rounded-lg border border-border bg-black/20 px-3 py-2 text-sm"
          />
          <input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="Action"
            className="rounded-lg border border-border bg-black/20 px-3 py-2 text-sm"
          />
          <select
            value={effect}
            onChange={(e) => setEffect(e.target.value)}
            className="rounded-lg border border-border bg-black/20 px-3 py-2 text-sm"
          >
            {["ALLOW", "DENY", "REQUIRE_APPROVAL", "AUDIT_ONLY"].map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <button type="button" onClick={create} className="rounded-lg bg-accent/20 px-4 py-2 text-sm text-accent">
            Create
          </button>
        </div>
        <div className="space-y-2">
          {(data?.policies ?? []).map((p) => (
            <div key={String(p.policyId)} className="rounded-xl border border-border p-3">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{String(p.name)}</span>
                <StatusPill value={`${String(p.effect)} · ${String(p.status)}`} />
              </div>
              <p className="text-xs text-muted">
                {String(p.action)} · priority {String(p.priority)}
              </p>
            </div>
          ))}
        </div>
      </Panel>
    </AdminShell>
  );
}

export function PolicyTestClient({ user }: { user: SafeUser }) {
  const [action, setAction] = useState("DELETE_INCIDENT");
  const [decision, setDecision] = useState<Row | null>(null);

  async function run() {
    const res = await fetch("/api/enterprise/policies/test", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const j = await res.json();
    setDecision(j.decision ?? j);
  }

  return (
    <AdminShell user={user}>
      <Panel title="Policy test" subtitle="Evaluate an action against active org + platform policies.">
        <div className="flex flex-wrap gap-2">
          <input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="rounded-lg border border-border bg-black/20 px-3 py-2 text-sm"
          />
          <button type="button" onClick={run} className="rounded-lg bg-accent/20 px-4 py-2 text-sm text-accent">
            Test
          </button>
        </div>
        {decision ? (
          <pre className="overflow-auto rounded-xl border border-border bg-black/30 p-4 text-xs">
            {JSON.stringify(decision, null, 2)}
          </pre>
        ) : null}
      </Panel>
    </AdminShell>
  );
}

export function SystemReadinessClient({ user }: { user: SafeUser }) {
  const { data, reload } = useJson<{ readiness: { checks: Row[]; asOf: string } }>("/api/enterprise/readiness");
  const health = useJson<{ health: Row }>("/api/enterprise/health/org");

  return (
    <AdminShell user={user}>
      <Panel title="System readiness" subtitle="Live checks for this organization.">
        <button type="button" onClick={reload} className="text-sm text-accent">
          Re-run
        </button>
        {health.data?.health ? (
          <div className="rounded-2xl border border-border p-4">
            <p className="text-sm">
              Org health: <strong>{String((health.data.health as Row).label)}</strong> (
              {String((health.data.health as Row).score)})
            </p>
          </div>
        ) : null}
        <div className="space-y-2">
          {(data?.readiness?.checks ?? []).map((c) => (
            <div key={String(c.key)} className="flex items-start justify-between rounded-xl border border-border p-3">
              <div>
                <p className="font-medium">{String(c.key)}</p>
                {c.problem ? <p className="text-xs text-muted">{String(c.problem)}</p> : null}
                {c.fix ? <p className="text-xs text-accent">{String(c.fix)}</p> : null}
              </div>
              <StatusPill value={String(c.status)} />
            </div>
          ))}
        </div>
      </Panel>
    </AdminShell>
  );
}

export function ExportsClient({ user }: { user: SafeUser }) {
  const { data, reload } = useJson<{ exports: Row[] }>("/api/enterprise/exports");
  const [type, setType] = useState("INCIDENTS");

  async function create() {
    await fetch("/api/enterprise/exports", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    reload();
  }

  return (
    <AdminShell user={user}>
      <Panel title="Exports" subtitle="Export jobs expire after 24 hours.">
        <div className="flex flex-wrap gap-2">
          <input
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-lg border border-border bg-black/20 px-3 py-2 text-sm"
          />
          <button type="button" onClick={create} className="rounded-lg bg-accent/20 px-4 py-2 text-sm text-accent">
            Request export
          </button>
        </div>
        <div className="space-y-2">
          {(data?.exports ?? []).map((e) => (
            <div key={String(e.exportId)} className="rounded-xl border border-border p-3 text-sm">
              {String(e.exportId)} · {String(e.type)} · <StatusPill value={String(e.status)} />
              <p className="text-xs text-muted">Expires {String(e.expiresAt)}</p>
            </div>
          ))}
        </div>
      </Panel>
    </AdminShell>
  );
}

export function TrainingClient({ user }: { user: SafeUser }) {
  const { data, reload } = useJson<{ drills: Row[] }>("/api/enterprise/training");
  const [name, setName] = useState("");
  const [date, setDate] = useState("");

  async function create() {
    if (!name.trim() || !date) return;
    await fetch("/api/enterprise/training", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, date: new Date(date).toISOString() }),
    });
    setName("");
    reload();
  }

  return (
    <AdminShell user={user}>
      <Panel title="Training drills" subtitle="Schedule and record safety drills.">
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Drill name"
            className="rounded-lg border border-border bg-black/20 px-3 py-2 text-sm"
          />
          <input
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-border bg-black/20 px-3 py-2 text-sm"
          />
          <button type="button" onClick={create} className="rounded-lg bg-accent/20 px-4 py-2 text-sm text-accent">
            Add
          </button>
        </div>
        <div className="space-y-2">
          {(data?.drills ?? []).map((d) => (
            <div key={String(d.drillId)} className="rounded-xl border border-border p-3">
              <p className="font-medium">{String(d.name)}</p>
              <p className="text-xs text-muted">
                {String(d.type)} · {String(d.date)} · {String(d.location || "—")}
              </p>
            </div>
          ))}
        </div>
      </Panel>
    </AdminShell>
  );
}

export function IntegrationsHealthClient({ user }: { user: SafeUser }) {
  const { data } = useJson<{ integrations: Row[] }>("/api/enterprise/integrations/health");
  return (
    <AdminShell user={user}>
      <Panel title="Integration health" subtitle="Connected vs not configured — no secrets exposed.">
        <div className="space-y-2">
          {(data?.integrations ?? []).map((i) => (
            <div key={String(i.key)} className="flex justify-between rounded-xl border border-border p-3">
              <span>{String(i.name)}</span>
              <StatusPill value={String(i.status)} />
            </div>
          ))}
        </div>
      </Panel>
    </AdminShell>
  );
}

export function ApprovalsClient({ user }: { user: SafeUser }) {
  const { data, reload } = useJson<{ approvals: Row[] }>("/api/enterprise/approvals?pending=1");
  const [showAll, setShowAll] = useState(false);
  const all = useJson<{ approvals: Row[] }>(showAll ? "/api/enterprise/approvals" : null);

  async function decide(id: string, decision: "APPROVED" | "REJECTED") {
    await fetch(`/api/enterprise/approvals/${id}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    reload();
    if (showAll) all.reload();
  }

  const list = showAll ? all.data?.approvals ?? [] : data?.approvals ?? [];

  return (
    <AdminShell user={user}>
      <Panel title="Approval center" subtitle="Human gate for high-impact actions.">
        <button type="button" onClick={() => setShowAll((v) => !v)} className="text-sm text-accent">
          {showAll ? "Show pending only" : "Show all"}
        </button>
        <div className="space-y-3">
          {list.map((a) => (
            <div key={String(a.approvalId)} className="rounded-2xl border border-border bg-surface/50 p-4">
              <div className="flex justify-between gap-2">
                <div>
                  <p className="font-medium">{String(a.action)}</p>
                  <p className="text-xs text-muted">
                    {String(a.approvalId)} · {String(a.riskLevel)} · {String(a.requestedByType)}
                  </p>
                </div>
                <StatusPill value={String(a.status)} />
              </div>
              <p className="mt-2 text-sm text-muted">{String(a.reason)}</p>
              {a.status === "PENDING" ? (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => decide(String(a.approvalId), "APPROVED")}
                    className="rounded-lg bg-accent/20 px-3 py-1.5 text-sm text-accent"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(String(a.approvalId), "REJECTED")}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm"
                  >
                    Reject
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>
    </AdminShell>
  );
}

export function EnterpriseDashboardClient({ user }: { user: SafeUser }) {
  const { data, loading, error } = useJson<{ cards: Row }>("/api/enterprise/dashboard");
  const cards = data?.cards as
    | {
        incidents?: number;
        alerts?: number;
        cameras?: { total: number; offline: number };
        approvals?: number;
        failedAutomations?: number;
        failedRuns?: number;
        ai?: Row;
      }
    | undefined;

  return (
    <AdminShell user={user}>
      <Panel title="Enterprise dashboard" subtitle="Live operational counts for your organization.">
        {loading ? <p className="text-sm text-muted">Loading…</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {cards ? (
          <CardGrid
            items={[
              { label: "Open incidents", value: cards.incidents ?? 0 },
              { label: "Active alerts", value: cards.alerts ?? 0 },
              {
                label: "Cameras",
                value: `${cards.cameras?.total ?? 0} (${cards.cameras?.offline ?? 0} offline)`,
              },
              { label: "Pending approvals", value: cards.approvals ?? 0 },
              { label: "Failed automations", value: cards.failedAutomations ?? 0 },
              { label: "Failed runs", value: cards.failedRuns ?? 0 },
              {
                label: "AI status",
                value: cards.ai?.available ? String(cards.ai.mode ?? "ready") : "not configured",
              },
            ]}
          />
        ) : null}
      </Panel>
    </AdminShell>
  );
}

export function WorkspaceClient({ user }: { user: SafeUser }) {
  const { data } = useJson<{
    summary: Row;
    tasks: Row[];
    approvals: Row[];
    incidents: Row[];
  }>("/api/enterprise/workspace");

  return (
    <AdminShell user={user}>
      <Panel title="My workspace" subtitle="Tasks, approvals, and incidents assigned to you.">
        {data?.summary ? (
          <CardGrid
            items={[
              { label: "Open tasks", value: Number(data.summary.openTasks ?? 0) },
              { label: "Pending approvals", value: Number(data.summary.pendingApprovals ?? 0) },
              { label: "Assigned incidents", value: Number(data.summary.assignedIncidents ?? 0) },
            ]}
          />
        ) : null}
        <div className="grid gap-4 lg:grid-cols-3">
          <section>
            <h2 className="mb-2 text-sm font-semibold">Tasks</h2>
            {(data?.tasks ?? []).map((t) => (
              <div key={String(t.actionId ?? t._id)} className="mb-2 rounded-xl border border-border p-3 text-sm">
                {String(t.title)}
              </div>
            ))}
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold">Approvals</h2>
            {(data?.approvals ?? []).map((a) => (
              <div key={String(a.approvalId)} className="mb-2 rounded-xl border border-border p-3 text-sm">
                {String(a.action)}
              </div>
            ))}
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold">Incidents</h2>
            {(data?.incidents ?? []).map((i) => (
              <div key={String(i.incidentId)} className="mb-2 rounded-xl border border-border p-3 text-sm">
                {String(i.title || i.incidentId)}
              </div>
            ))}
          </section>
        </div>
      </Panel>
    </AdminShell>
  );
}

export function TeamWorkspaceClient({ user }: { user: SafeUser }) {
  const { data } = useJson<{
    summary: Row;
    tasks: Row[];
    incidents: Row[];
  }>("/api/enterprise/workspace");

  return (
    <AdminShell user={user}>
      <Panel title="Team workspace" subtitle="Shared operational queue for your organization.">
        <CardGrid
          items={[
            { label: "Visible tasks", value: data?.tasks?.length ?? 0 },
            { label: "Visible incidents", value: data?.incidents?.length ?? 0 },
          ]}
        />
        <ul className="space-y-2 text-sm">
          {(data?.tasks ?? []).map((t) => (
            <li key={String(t.actionId ?? t._id)} className="rounded-xl border border-border p-3">
              {String(t.title)} · {String(t.status)}
            </li>
          ))}
        </ul>
      </Panel>
    </AdminShell>
  );
}

export function SupportClient({ user }: { user: SafeUser }) {
  const { data, reload } = useJson<{ tickets: Row[] }>("/api/enterprise/support");
  const [subject, setSubject] = useState("");

  async function create() {
    if (!subject.trim()) return;
    await fetch("/api/enterprise/support", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject }),
    });
    setSubject("");
    reload();
  }

  return (
    <AdminShell user={user}>
      <Panel title="Support" subtitle="Organization support tickets.">
        <div className="flex flex-wrap gap-2">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="rounded-lg border border-border bg-black/20 px-3 py-2 text-sm"
          />
          <button type="button" onClick={create} className="rounded-lg bg-accent/20 px-4 py-2 text-sm text-accent">
            Open ticket
          </button>
        </div>
        <div className="space-y-2">
          {(data?.tickets ?? []).map((t) => (
            <div key={String(t.ticketId)} className="rounded-xl border border-border p-3">
              <div className="flex justify-between">
                <span className="font-medium">{String(t.subject)}</span>
                <StatusPill value={String(t.status)} />
              </div>
              <p className="text-xs text-muted">
                {String(t.ticketId)} · {String(t.priority)}
              </p>
            </div>
          ))}
        </div>
      </Panel>
    </AdminShell>
  );
}

export function OperationsCalendarClient({ user }: { user: SafeUser }) {
  const training = useJson<{ drills: Row[] }>("/api/enterprise/training");
  const workspace = useJson<{ tasks: Row[] }>("/api/enterprise/workspace");

  const items = [
    ...(training.data?.drills ?? []).map((d) => ({
      id: String(d.drillId),
      title: String(d.name),
      date: String(d.date),
      kind: "Training",
    })),
    ...(workspace.data?.tasks ?? []).map((t) => ({
      id: String(t.actionId ?? t._id),
      title: String(t.title),
      date: String(t.dueAt ?? t.createdAt ?? ""),
      kind: "Task",
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <AdminShell user={user}>
      <Panel title="Operations calendar" subtitle="Training drills and task due dates.">
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={`${i.kind}-${i.id}`} className="rounded-xl border border-border p-3 text-sm">
              <span className="text-xs text-muted">{i.kind}</span> {i.title}
              <p className="text-xs text-muted">{i.date || "No date"}</p>
            </li>
          ))}
        </ul>
      </Panel>
    </AdminShell>
  );
}

/* ─── Super-admin ─── */
export function AiAgentsClient({ user }: { user: SafeUser }) {
  const { data, reload } = useJson<{ agents: Row[] }>("/api/super-admin/ai-agents");

  async function kill(id: string) {
    await fetch(`/api/super-admin/ai-agents/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ killSwitch: true, reason: "Disabled from AI Agents console" }),
    });
    reload();
  }

  async function setMode(id: string, actionMode: string) {
    await fetch(`/api/super-admin/ai-agents/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionMode }),
    });
    reload();
  }

  return (
    <SuperAdminShell user={user}>
      <Panel title="AI Agents" subtitle="Platform agent registry with kill switches.">
        <div className="space-y-3">
          {(data?.agents ?? []).map((a) => (
            <div key={String(a.agentId)} className="rounded-2xl border border-border bg-surface/50 p-4">
              <div className="flex justify-between gap-2">
                <div>
                  <p className="font-semibold">{String(a.name)}</p>
                  <p className="text-xs text-muted">
                    {String(a.agentId)} · {String(a.type)} · risk {String(a.riskLevel)}
                  </p>
                </div>
                <StatusPill value={String(a.status)} />
              </div>
              <p className="mt-2 text-xs text-muted">Mode: {String(a.actionMode)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {["OBSERVE", "RECOMMEND", "DRAFT", "APPROVAL"].map((m) => (
                  <button key={m} type="button" onClick={() => setMode(String(a.agentId), m)} className="text-[10px] text-accent">
                    {m}
                  </button>
                ))}
                <button type="button" onClick={() => kill(String(a.agentId))} className="text-[10px] text-red-400">
                  Kill switch
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </SuperAdminShell>
  );
}

export function AiAgentToolsClient({ user }: { user: SafeUser }) {
  const { data } = useJson<{ tools: Row[] }>("/api/super-admin/ai-agents/tools");
  return (
    <SuperAdminShell user={user}>
      <Panel title="Agent tools" subtitle="Registered tools across all agents.">
        <div className="space-y-2">
          {(data?.tools ?? []).map((t, i) => (
            <div key={`${String(t.agentId)}-${String(t.tool)}-${i}`} className="rounded-xl border border-border p-3 text-sm">
              <span className="font-medium">{String(t.tool)}</span>
              <p className="text-xs text-muted">
                {String(t.agentName)} · {String(t.actionMode)} · {String(t.status)}
              </p>
            </div>
          ))}
        </div>
      </Panel>
    </SuperAdminShell>
  );
}

export function AiAgentTracesClient({ user }: { user: SafeUser }) {
  const { data } = useJson<{ traces: Row[] }>("/api/super-admin/ai-agents/traces");
  return (
    <SuperAdminShell user={user}>
      <Panel title="Agent traces" subtitle="Recent agent tool decisions and outcomes.">
        <div className="space-y-2">
          {(data?.traces ?? []).map((t) => (
            <div key={String(t.traceId)} className="rounded-xl border border-border p-3 text-sm">
              <div className="flex justify-between">
                <span>{String(t.agentId)} · {String(t.tool || "—")}</span>
                <StatusPill value={String(t.outcome)} />
              </div>
              <p className="text-xs text-muted">{String(t.requestSummary)}</p>
            </div>
          ))}
        </div>
      </Panel>
    </SuperAdminShell>
  );
}

export function AiGovernanceClient({ user }: { user: SafeUser }) {
  const { data } = useJson<{ governance: Row; agents: Row[]; recentTraces: Row[] }>(
    "/api/super-admin/ai-governance"
  );
  const g = data?.governance;
  return (
    <SuperAdminShell user={user}>
      <Panel title="AI governance" subtitle="Aggregate agents, traces, approvals, and denials.">
        {g ? (
          <CardGrid
            items={[
              { label: "Agents", value: Number(g.agentsTotal ?? 0) },
              { label: "Active", value: Number(g.agentsActive ?? 0) },
              { label: "Disabled", value: Number(g.agentsDisabled ?? 0) },
              { label: "AI approvals pending", value: Number(g.pendingAiApprovals ?? 0) },
              { label: "Denials", value: Number(g.denials ?? 0) },
              { label: "Waiting approval", value: Number(g.waitingApproval ?? 0) },
            ]}
          />
        ) : null}
      </Panel>
    </SuperAdminShell>
  );
}

export function SystemJobsClient({ user }: { user: SafeUser }) {
  const { data } = useJson<{ stats: Row; jobs: Row[] }>("/api/super-admin/system/jobs");
  const s = data?.stats;
  return (
    <SuperAdminShell user={user}>
      <Panel title="Background jobs" subtitle="Queue stats and recent jobs.">
        {s ? (
          <CardGrid
            items={[
              { label: "Queued", value: Number(s.queued ?? 0) },
              { label: "Running", value: Number(s.running ?? 0) },
              { label: "Retrying", value: Number(s.retrying ?? 0) },
              { label: "Completed", value: Number(s.completed ?? 0) },
              { label: "Failed", value: Number(s.failed ?? 0) },
              { label: "Dead", value: Number(s.dead ?? 0) },
            ]}
          />
        ) : null}
        <Link href="/super-admin/system/jobs/dead-letter" className="text-sm text-accent">
          Dead-letter queue
        </Link>
        <div className="space-y-2">
          {(data?.jobs ?? []).slice(0, 40).map((j) => (
            <div key={String(j.jobId)} className="rounded-xl border border-border p-3 text-sm">
              {String(j.jobId)} · {String(j.type)} · <StatusPill value={String(j.status)} />
            </div>
          ))}
        </div>
      </Panel>
    </SuperAdminShell>
  );
}

export function DeadLetterClient({ user }: { user: SafeUser }) {
  const { data, reload } = useJson<{ jobs: Row[] }>("/api/super-admin/system/jobs/dead-letter");

  async function retry(jobId: string) {
    await fetch("/api/super-admin/system/jobs/dead-letter", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    reload();
  }

  return (
    <SuperAdminShell user={user}>
      <Panel title="Dead-letter jobs" subtitle="Retry failed jobs that exhausted attempts.">
        <div className="space-y-2">
          {(data?.jobs ?? []).map((j) => (
            <div key={String(j.jobId)} className="flex items-center justify-between rounded-xl border border-border p-3">
              <div className="text-sm">
                <p>{String(j.jobId)} · {String(j.type)}</p>
                <p className="text-xs text-muted">{String(j.error || "—")}</p>
              </div>
              <button type="button" onClick={() => retry(String(j.jobId))} className="text-sm text-accent">
                Retry
              </button>
            </div>
          ))}
        </div>
      </Panel>
    </SuperAdminShell>
  );
}

export function ServicesCatalogClient({ user }: { user: SafeUser }) {
  const { data } = useJson<{ services: Row[] }>("/api/super-admin/services");
  return (
    <SuperAdminShell user={user}>
      <Panel title="Service catalog" subtitle="Platform service health snapshot.">
        <div className="space-y-2">
          {(data?.services ?? []).map((s) => (
            <div key={String(s.name)} className="flex justify-between rounded-xl border border-border p-3">
              <span>
                {String(s.name)} <span className="text-xs text-muted">v{String(s.version)}</span>
              </span>
              <StatusPill value={String(s.status)} />
            </div>
          ))}
        </div>
      </Panel>
    </SuperAdminShell>
  );
}

export function PostmortemsClient({ user }: { user: SafeUser }) {
  const { data, reload } = useJson<{ postmortems: Row[] }>("/api/super-admin/incidents/postmortems");
  const [platformIncidentId, setPlatformIncidentId] = useState("");
  const [summary, setSummary] = useState("");

  async function create() {
    if (!platformIncidentId.trim()) return;
    await fetch("/api/super-admin/incidents/postmortems", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platformIncidentId, summary }),
    });
    setPlatformIncidentId("");
    setSummary("");
    reload();
  }

  return (
    <SuperAdminShell user={user}>
      <Panel title="Postmortems" subtitle="Platform incident postmortem records.">
        <div className="flex flex-wrap gap-2">
          <input
            value={platformIncidentId}
            onChange={(e) => setPlatformIncidentId(e.target.value)}
            placeholder="Platform incident id"
            className="rounded-lg border border-border bg-black/20 px-3 py-2 text-sm"
          />
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Summary"
            className="rounded-lg border border-border bg-black/20 px-3 py-2 text-sm"
          />
          <button type="button" onClick={create} className="rounded-lg bg-accent/20 px-4 py-2 text-sm text-accent">
            Create
          </button>
        </div>
        <div className="space-y-2">
          {(data?.postmortems ?? []).map((p) => (
            <div key={String(p.postmortemId)} className="rounded-xl border border-border p-3">
              <p className="font-medium">{String(p.postmortemId)}</p>
              <p className="text-xs text-muted">Incident {String(p.platformIncidentId)}</p>
              <p className="mt-1 text-sm text-muted">{String(p.summary || "—")}</p>
            </div>
          ))}
        </div>
      </Panel>
    </SuperAdminShell>
  );
}
