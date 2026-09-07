"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";

export function VideoAdminClients({
  user,
  view,
}: {
  user: SafeUser;
  view: "ai" | "inventory" | "maintenance" | "privacy" | "analytics";
}) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [policy, setPolicy] = useState<Record<string, unknown> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (view === "ai" || view === "privacy") {
        const p = await fetch("/api/video/policy", { credentials: "include" }).then((r) => r.json());
        setPolicy(p);
      }
      if (view === "analytics") {
        setData(await fetch("/api/video/ops?view=analytics", { credentials: "include" }).then((r) => r.json()));
      }
      if (view === "inventory") {
        setData(await fetch("/api/video/ops?view=inventory", { credentials: "include" }).then((r) => r.json()));
      }
      if (view === "maintenance") {
        setData(await fetch("/api/video/ops?view=maintenance", { credentials: "include" }).then((r) => r.json()));
      }
    };
    load();
  }, [view]);

  const savePolicy = async (patch: Record<string, unknown>) => {
    const res = await fetch("/api/video/policy", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setMsg(res.ok ? "Saved" : "Failed");
    const p = await fetch("/api/video/policy", { credentials: "include" }).then((r) => r.json());
    setPolicy(p);
  };

  return (
    <AdminShell user={user}>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold capitalize">Video {view}</h1>
        <Link href="/video" className="rounded border border-white/15 px-3 py-1.5 text-xs">
          Video center
        </Link>
      </div>
      {msg && <p className="mb-3 text-xs text-sky-300">{msg}</p>}

      {view === "ai" && policy?.policy ? (
        <div className="space-y-4 text-sm">
          <div className="rounded-xl border border-border p-4">
            <p>Processing mode: {String((policy.policy as Record<string, unknown>).processingMode)}</p>
            <p className="text-xs text-muted">
              Demo mode: {String((policy.policy as Record<string, unknown>).demoMode)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {["DISABLED", "ON_DEMAND", "SCHEDULED", "CONTINUOUS"].map((m) => (
                <button
                  key={m}
                  type="button"
                  className="rounded border border-white/15 px-2 py-1"
                  onClick={() => savePolicy({ processingMode: m })}
                >
                  {m}
                </button>
              ))}
              <button
                type="button"
                className="rounded border border-amber-500/30 px-2 py-1 text-amber-200"
                onClick={() => savePolicy({ demoMode: true })}
              >
                Enable DEMO MODE
              </button>
            </div>
          </div>
          <p className="text-xs text-muted">
            Sensitive categories (person/crowd) stay off unless explicitly allowed. AI outputs are signals, not
            accusations.
          </p>
        </div>
      ) : null}

      {view === "privacy" ? (
        <div className="rounded-xl border border-border p-4 text-xs">
          <p className="font-semibold">Privacy zones</p>
          <ul className="mt-2 space-y-1">
            {((policy?.privacyZones as Array<Record<string, unknown>>) || []).map((z) => (
              <li key={String(z.zoneId)}>
                {String(z.name)} · camera {String(z.cameraId)} · {String(z.status)}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-muted">
            Evidence access requires permission; sensitive evidence may require approval. Retention follows org
            policy.
          </p>
        </div>
      ) : null}

      {view === "analytics" && data?.analytics ? (
        <pre className="overflow-auto rounded-xl border border-border p-4 text-[11px] text-muted">
          {JSON.stringify(data.analytics, null, 2)}
        </pre>
      ) : null}

      {view === "inventory" && data?.inventory ? (
        <div className="space-y-3 text-sm">
          <pre className="rounded-xl border border-border p-4 text-xs">
            {JSON.stringify(data.inventory, null, 2)}
          </pre>
        </div>
      ) : null}

      {view === "maintenance" && (
        <div className="space-y-4 text-xs">
          <section className="rounded-xl border border-border p-4">
            <h2 className="font-semibold">Suggestions (evidence-based, not failure claims)</h2>
            <ul className="mt-2 space-y-2">
              {((data?.suggestions as Array<Record<string, unknown>>) || []).map((s) => (
                <li key={String(s.cameraId)}>
                  {String(s.name)} — {String(s.recommendation)} ({String(s.claim)})
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border border-border p-4">
            <h2 className="font-semibold">Tickets</h2>
            <ul className="mt-2 space-y-1">
              {((data?.tickets as Array<Record<string, unknown>>) || []).map((t) => (
                <li key={String(t.ticketId)}>
                  {String(t.ticketId)} · {String(t.issue)} · {String(t.status)}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
