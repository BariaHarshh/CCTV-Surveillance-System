"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { WEBHOOK_EVENTS } from "@/lib/platform/constants";

type WebhookRow = {
  id: string;
  webhookId: string;
  url: string;
  events: string[];
  enabled: boolean;
  secretPrefix: string;
};

type Delivery = {
  id: string;
  event: string;
  endpoint: string;
  status: string;
  httpCode: number | null;
  timestamp: string;
};

export function WebhooksClient({ user }: { user: SafeUser }) {
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["alert.created"]);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const [w, d] = await Promise.all([
      fetch("/api/settings/webhooks", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/settings/webhooks?deliveries=1", { credentials: "include" }).then((r) => r.json()),
    ]);
    setWebhooks(w.webhooks ?? []);
    setDeliveries(d.deliveries ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setError("");
    setSecret("");
    const res = await fetch("/api/settings/webhooks", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, events }),
    });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error ?? "Failed to create webhook.");
      return;
    }
    setSecret(j.webhook.secret);
    setUrl("");
    await load();
  }

  function toggleEvent(ev: string) {
    setEvents((prev) => (prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]));
  }

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Webhooks</h1>
      <p className="mt-1 text-muted">Outbound event endpoints and delivery history</p>

      <section className="mt-8 rounded-2xl border border-border bg-surface/50 p-6">
        <label className="block text-sm">
          <span className="text-muted">Endpoint URL</span>
          <input
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
            placeholder="https://example.com/hooks/acg"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          {WEBHOOK_EVENTS.map((ev) => (
            <button
              key={ev}
              type="button"
              onClick={() => toggleEvent(ev)}
              className={`rounded-lg border px-2.5 py-1 text-xs ${
                events.includes(ev)
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-border text-muted"
              }`}
            >
              {ev}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={create}
          disabled={!url || events.length === 0}
          className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          Create webhook
        </button>
        {secret && (
          <p className="mt-4 break-all rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 font-mono text-sm">
            Signing secret (once): {secret}
          </p>
        )}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </section>

      {loading ? (
        <Loader2 className="mt-8 h-8 w-8 animate-spin text-accent" />
      ) : (
        <>
          <div className="mt-6 space-y-3">
            {webhooks.map((w) => (
              <div key={w.id} className="rounded-2xl border border-border bg-surface/40 p-4">
                <div className="font-mono text-xs text-muted">{w.webhookId}</div>
                <div className="mt-1 break-all text-sm">{w.url}</div>
                <div className="mt-2 text-xs text-muted">{w.events.join(", ")}</div>
              </div>
            ))}
            {webhooks.length === 0 && <p className="text-sm text-muted">No webhooks configured.</p>}
          </div>

          <h2 className="mt-10 text-lg font-semibold">Recent deliveries</h2>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">HTTP</th>
                  <th className="px-4 py-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr key={d.id} className="border-b border-white/[0.04]">
                    <td className="px-4 py-3">{d.event}</td>
                    <td className="px-4 py-3">{d.status}</td>
                    <td className="px-4 py-3 text-muted">{d.httpCode ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{new Date(d.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
                {deliveries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted">
                      No deliveries yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminShell>
  );
}
