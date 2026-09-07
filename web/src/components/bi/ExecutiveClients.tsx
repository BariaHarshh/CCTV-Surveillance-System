"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";

export function ExecutiveCommandClient({
  user,
  view = "command",
}: {
  user: SafeUser;
  view?: "command" | "alerts" | "actions" | "review" | "board";
}) {
  const [period, setPeriod] = useState("30D");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [ask, setAsk] = useState("");
  const [brief, setBrief] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const v = view === "alerts" ? "attention" : view === "board" ? "command" : "command";
    const res = await fetch(`/api/executive/command?view=${v}&period=${period}`, {
      credentials: "include",
    });
    const json = await res.json();
    setData(json.executive || json);
    setLoading(false);
  }, [period, view]);

  useEffect(() => {
    load();
  }, [load]);

  const askCopilot = async () => {
    const res = await fetch("/api/executive/command", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ask", question: ask || "What requires executive attention?" }),
    });
    const json = await res.json();
    setBrief(json.brief);
  };

  const exec = (data?.organizationName ? data : (data as { executive?: Record<string, unknown> })?.executive) as
    | Record<string, unknown>
    | undefined;
  const pack = exec || data;

  return (
    <AdminShell user={user}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-accent">Executive Intelligence</p>
          <h1 className="text-2xl font-bold lg:text-3xl">
            {view === "board" ? "Leadership View" : view === "alerts" ? "Executive Alerts" : "Executive Command"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Decision-grade analytics — actual data only. Forecasts and AI insights are labeled.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {["7D", "30D", "90D"].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-full border px-3 py-1.5 ${period === p ? "border-accent text-accent" : "border-border"}`}
            >
              {p}
            </button>
          ))}
          <Link href="/admin/executive" className="rounded-full border border-border px-3 py-1.5">
            Classic overview
          </Link>
          <Link href="/governance" className="rounded-full border border-border px-3 py-1.5">
            Governance
          </Link>
        </div>
      </div>

      {loading && !pack ? (
        <div className="mt-8 h-40 animate-pulse rounded-2xl bg-glass" />
      ) : (
        <>
          <section className="mt-6 rounded-2xl border border-border bg-surface/40 p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs text-muted">{String(pack?.organizationName || "Organization")}</p>
                <h2 className="mt-1 text-3xl font-semibold tracking-tight">
                  Organization Health · {String(pack?.overallStatus || "—")}
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-muted">{String(pack?.keyChanges || "")}</p>
                <p className="mt-1 text-xs text-amber-200/80">
                  {Number(pack?.attentionCount || 0)} area(s) require attention
                </p>
              </div>
              <div className="text-right text-xs text-muted">
                <p>Period: {String(pack?.reportingPeriod || period)}</p>
                <p>
                  Last updated:{" "}
                  {pack?.lastUpdated ? new Date(String(pack.lastUpdated)).toLocaleString() : "—"}
                </p>
                <p>Freshness: {String(pack?.freshness || "RECENT")}</p>
              </div>
            </div>
          </section>

          {view !== "alerts" && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Safety Score",
                  value: (pack?.safetyScore as { overall?: number })?.overall ?? "—",
                  href: "#score",
                },
                {
                  label: "Active Incidents",
                  value: (pack?.metrics as { activeIncidents?: number })?.activeIncidents ?? "—",
                  href: "/analytics/incidents",
                },
                {
                  label: "Critical Alerts",
                  value: (pack?.metrics as { criticalAlerts?: number })?.criticalAlerts ?? "—",
                  href: "/admin/alerts",
                },
                {
                  label: "Camera Health",
                  value: (pack?.metrics as { cameraHealth?: number })?.cameraHealth ?? "—",
                  href: "/analytics/cameras",
                },
              ].map((c) => (
                <Link
                  key={c.label}
                  href={c.href}
                  className="rounded-xl border border-border bg-surface/50 p-4"
                >
                  <p className="text-[10px] uppercase tracking-wider text-muted">{c.label}</p>
                  <p className="mt-1 text-2xl font-bold">{String(c.value)}</p>
                </Link>
              ))}
            </div>
          )}

          {(view === "command" || view === "board") && (
            <>
              <section id="score" className="mt-8">
                <h3 className="text-sm font-semibold">Configured Safety Performance Score</h3>
                <p className="mt-1 text-xs text-muted">
                  {(pack?.safetyScore as { disclaimer?: string })?.disclaimer ||
                    "Operational analytics indicator — not objective real-world safety."}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                  {((pack?.kpis as Array<Record<string, unknown>>) || []).slice(0, 6).map((k) => (
                    <div key={String(k.kpiId)} className="rounded-xl border border-border p-3">
                      <p className="font-medium">{String(k.name)}</p>
                      <p className="mt-1 text-lg">
                        {k.value == null ? "NO DATA" : `${k.value}${k.unit ? ` ${k.unit}` : ""}`}
                      </p>
                      <p className="text-muted">
                        {String(k.status)} · {String(k.trend)}
                        {k.changePercent != null ? ` · ${k.changePercent}%` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-8 grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold">Top Risks</h3>
                  <ul className="mt-2 space-y-2 text-sm">
                    {((pack?.topRisks as Array<Record<string, unknown>>) || []).map((r, i) => (
                      <li key={i} className="flex justify-between rounded-lg border border-border px-3 py-2">
                        <span>
                          {i + 1}. {String(r.name)}
                        </span>
                        <Link href={String(r.href || "/map")} className="text-accent">
                          Open Map
                        </Link>
                      </li>
                    ))}
                    {!((pack?.topRisks as unknown[]) || []).length && (
                      <li className="text-muted">Insufficient data</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Forecast (incident volume)</h3>
                  <p className="mt-1 text-[10px] uppercase text-amber-300">
                    {(pack?.forecast as { label?: string })?.label || "FORECAST"}
                  </p>
                  <p className="mt-2 text-sm">
                    {(pack?.forecast as { confidence?: string })?.confidence === "UNAVAILABLE"
                      ? "Forecast unavailable."
                      : `Estimate: ${(pack?.forecast as { forecast?: number })?.forecast} (range ${JSON.stringify((pack?.forecast as { range?: unknown })?.range)}) · confidence ${(pack?.forecast as { confidence?: string })?.confidence}`}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    {(pack?.forecast as { disclaimer?: string })?.disclaimer}
                  </p>
                </div>
              </section>
            </>
          )}

          <section className="mt-8">
            <h3 className="text-sm font-semibold">Needs Attention</h3>
            <div className="mt-3 space-y-3">
              {((pack?.decisionCards as Array<Record<string, unknown>>) ||
                (pack?.items as Array<Record<string, unknown>>) ||
                []
              ).map((c, i) => (
                <article key={i} className="rounded-xl border border-border p-4 text-sm">
                  <p className="text-[10px] uppercase text-muted">Issue</p>
                  <p className="font-semibold">{String(c.issue)}</p>
                  <p className="mt-2 text-[10px] uppercase text-muted">Impact</p>
                  <p>{String(c.impact)}</p>
                  <p className="mt-2 text-[10px] uppercase text-muted">Recommendation</p>
                  <p>{String(c.recommendation || c.nextStep)}</p>
                  <Link href={String(c.href || "#")} className="mt-3 inline-block text-xs text-accent">
                    Open Details
                  </Link>
                </article>
              ))}
            </div>
          </section>

          {(view === "command" || view === "review") && (
            <section className="mt-10 rounded-2xl border border-accent/20 bg-accent/5 p-5">
              <h3 className="text-sm font-semibold">Executive Copilot</h3>
              <p className="mt-1 text-xs text-muted">AI-generated insights from authorized analytics — not fabricated numbers.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  value={ask}
                  onChange={(e) => setAsk(e.target.value)}
                  placeholder="What changed this month?"
                  className="min-h-11 flex-1 rounded-xl border border-border bg-black/30 px-3 text-sm"
                />
                <button
                  type="button"
                  onClick={askCopilot}
                  className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-black"
                >
                  Ask
                </button>
              </div>
              {brief && (
                <div className="mt-4 space-y-2 text-sm">
                  <p className="text-[10px] uppercase text-amber-300">{String(brief.label)}</p>
                  <p>{String(brief.answer)}</p>
                  <ul className="text-xs text-muted">
                    {((brief.supportingData as Array<{ label: string; href: string }>) || []).map((s) => (
                      <li key={s.href}>
                        <Link href={s.href} className="text-accent">
                          {s.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          <nav className="mt-10 flex flex-wrap gap-3 text-xs text-muted">
            <Link href="/analytics/incidents">Incidents</Link>
            <Link href="/analytics/response">Response</Link>
            <Link href="/analytics/cameras">Cameras</Link>
            <Link href="/analytics/inspections">Inspections</Link>
            <Link href="/analytics/teams">Teams</Link>
            <Link href="/strategy">Strategy</Link>
            <Link href="/executive/actions">Actions</Link>
            <Link href="/reports/executive">Executive Reports</Link>
            <Link href="/governance/ai">AI Governance</Link>
          </nav>
        </>
      )}
    </AdminShell>
  );
}

export function GovernanceClient({
  user,
  view = "center",
}: {
  user: SafeUser;
  view?: string;
}) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch(`/api/governance?view=${view}`, { credentials: "include" })
      .then((r) => r.json())
      .then(setData);
  }, [view]);

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold capitalize">Governance · {view}</h1>
      <p className="mt-1 text-sm text-muted">
        Policies, decisions, access, audit — compliance labels are UNKNOWN unless verified in-system.
      </p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {["center", "decisions", "strategy", "data", "access", "audit", "security", "schedules"].map((v) => (
          <Link
            key={v}
            href={v === "center" ? "/governance" : v === "strategy" ? "/strategy" : `/governance/${v === "decisions" ? "decisions" : v}`}
            className="rounded-full border border-border px-3 py-1.5"
          >
            {v}
          </Link>
        ))}
        <Link href="/governance/ai" className="rounded-full border border-border px-3 py-1.5">
          AI
        </Link>
      </div>
      <pre className="mt-6 max-h-[70vh] overflow-auto rounded-xl border border-border p-4 text-[11px] text-muted">
        {JSON.stringify(data, null, 2)}
      </pre>
    </AdminShell>
  );
}

export function AnalyticsAliasClient({
  user,
  domain,
}: {
  user: SafeUser;
  domain: string;
}) {
  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold capitalize">{domain} Analytics</h1>
      <p className="mt-2 text-sm text-muted">
        Extends Safety Intelligence. Full interactive domain:
      </p>
      <Link
        href={`/admin/analytics/${domain === "inspections" || domain === "patrol" ? "data-quality" : domain}`}
        className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-black"
      >
        Open {domain} analytics
      </Link>
      <div className="mt-6 text-xs text-muted">
        <Link href="/executive" className="text-accent">
          Executive Command
        </Link>
        {" · "}
        <Link href="/admin/analytics" className="text-accent">
          Safety Intelligence Hub
        </Link>
      </div>
    </AdminShell>
  );
}
