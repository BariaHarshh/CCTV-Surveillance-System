"use client";

import { useCallback, useEffect, useState } from "react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";

type Insight = {
  id: string;
  insightId?: string;
  title: string;
  evidence: string[];
  change?: string | null;
  affectedArea?: string | null;
  suggestedReview?: string | null;
};

export function InsightsClient({ user }: { user: SafeUser }) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/insights", { credentials: "include" });
    const json = await res.json();
    setInsights(json.insights ?? []);
    setMessage(json.message ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function refresh() {
    setLoading(true);
    const res = await fetch("/api/insights?refresh=true", { credentials: "include" });
    const json = await res.json();
    setInsights(json.insights ?? []);
    setMessage(json.message ?? null);
    setLoading(false);
  }

  async function feedback(id: string, value: string) {
    await fetch(`/api/insights/${id}/feedback`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback: value }),
    });
  }

  return (
    <AdminShell user={user}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Safety Insights</h1>
          <p className="mt-1 text-muted">
            Structured insights from verified metrics only. Recommendations are Suggested Review — not guaranteed solutions.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black"
        >
          Generate from Metrics
        </button>
      </div>

      {loading ? (
        <div className="mt-8 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-glass" />
          ))}
        </div>
      ) : insights.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
          {message ?? "No data available for this period."}
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {insights.map((ins) => (
            <article key={ins.id} className="rounded-2xl border border-border bg-surface/40 p-5">
              <p className="text-[10px] uppercase tracking-wider text-accent">Insight</p>
              <h2 className="mt-1 text-lg font-semibold">{ins.title}</h2>
              <div className="mt-3 text-sm">
                <p className="text-xs text-muted">Evidence</p>
                <ul className="mt-1 list-inside list-disc text-sm">
                  {(ins.evidence ?? []).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
              {ins.change && (
                <p className="mt-2 text-sm">
                  <span className="text-muted">Change:</span> {ins.change}
                </p>
              )}
              {ins.affectedArea && (
                <p className="mt-1 text-sm">
                  <span className="text-muted">Affected area:</span> {ins.affectedArea}
                </p>
              )}
              {ins.suggestedReview && (
                <p className="mt-3 rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-sm">
                  <span className="font-semibold text-accent">Suggested Review:</span> {ins.suggestedReview}
                </p>
              )}
              <div className="mt-3 flex gap-2 text-[10px]">
                {["USEFUL", "NOT_USEFUL", "INCORRECT"].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => feedback(ins.id, f)}
                    className="rounded-full border border-border px-2 py-1 hover:text-accent"
                  >
                    {f.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
