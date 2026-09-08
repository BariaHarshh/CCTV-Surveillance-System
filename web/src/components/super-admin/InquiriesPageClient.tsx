"use client";

import { useCallback, useEffect, useState } from "react";
import { Inbox, RefreshCw, Search } from "lucide-react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";
import { EmptyState } from "@/components/super-admin/EmptyState";
import { formatRelativeTime } from "@/lib/utils/time";
import { cn } from "@/lib/utils";

interface Inquiry {
  id: string;
  inquiryId: string;
  name: string;
  email: string;
  phone: string;
  organizationName: string;
  campusType: string;
  estimatedCameras: string;
  requirements: string;
  status: string;
  notes: string;
  createdAt: string;
}

const STATUSES = ["ALL", "NEW", "REVIEWED", "CONTACTED", "CLOSED"] as const;

export function InquiriesPageClient({ user }: { user: SafeUser }) {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("ALL");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (status !== "ALL") params.set("status", status);
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/super-admin/inquiries?${params}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load inquiries");
      setItems(data.inquiries ?? []);
      setUnread(data.unread ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(id: string, next: string) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/super-admin/inquiries/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      setSelected(data.inquiry);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <SuperAdminShell user={user}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Purchase Inquiries</h1>
          <p className="mt-1 text-muted">
            Messages from website visitors interested in buying AI Campus Guardian.
            {unread > 0 && (
              <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                {unread} new
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs text-muted hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, organization..."
            className="w-full rounded-xl border border-border bg-glass py-2.5 pl-10 pr-4 text-sm outline-none focus:border-accent/40"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-border bg-glass px-4 py-2.5 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s} className="bg-surface">
              {s === "ALL" ? "All statuses" : s}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="space-y-2 lg:col-span-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-glass" />
            ))
          ) : items.length === 0 ? (
            <EmptyState
              title="No inquiries yet"
              description="When a visitor submits the interest form on the website, it will appear here."
              icon="inbox"
            />
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item)}
                className={cn(
                  "w-full rounded-xl border px-4 py-3 text-left transition",
                  selected?.id === item.id
                    ? "border-accent/30 bg-accent/5"
                    : item.status === "NEW"
                      ? "border-accent/20 bg-glass hover:bg-glass"
                      : "border-border bg-glass hover:bg-glass"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.organizationName}</p>
                    <p className="text-xs text-muted">
                      {item.name} · {item.email}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                      item.status === "NEW" ? "bg-accent/15 text-accent" : "bg-white/5 text-muted"
                    )}
                  >
                    {item.status}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-muted">{item.requirements}</p>
                <p className="mt-1 text-[10px] text-muted">{formatRelativeTime(new Date(item.createdAt))}</p>
              </button>
            ))
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface/50 p-6 lg:col-span-3">
          {!selected ? (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center text-muted">
              <Inbox className="h-10 w-10 opacity-40" />
              <p className="mt-3 text-sm">Select an inquiry to read the full requirements.</p>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-muted">{selected.inquiryId}</p>
                  <h2 className="mt-1 text-xl font-semibold">{selected.organizationName}</h2>
                </div>
                <select
                  value={selected.status}
                  disabled={updating}
                  onChange={(e) => updateStatus(selected.id, e.target.value)}
                  className="rounded-lg border border-border bg-glass px-3 py-1.5 text-xs"
                >
                  {["NEW", "REVIEWED", "CONTACTED", "CLOSED"].map((s) => (
                    <option key={s} value={s} className="bg-surface">
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted">Contact</dt>
                  <dd>{selected.name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Email</dt>
                  <dd>
                    <a href={`mailto:${selected.email}`} className="text-accent hover:underline">
                      {selected.email}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Phone</dt>
                  <dd>{selected.phone || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Campus type</dt>
                  <dd>{selected.campusType || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Estimated cameras</dt>
                  <dd>{selected.estimatedCameras || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Submitted</dt>
                  <dd>{new Date(selected.createdAt).toLocaleString()}</dd>
                </div>
              </dl>

              <div className="mt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Requirements</h3>
                <p className="mt-2 whitespace-pre-wrap rounded-xl border border-border bg-black/20 p-4 text-sm leading-relaxed">
                  {selected.requirements}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </SuperAdminShell>
  );
}
