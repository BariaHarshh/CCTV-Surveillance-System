"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";

function AssetMapInner({ user }: { user: SafeUser }) {
  const sp = useSearchParams();
  const [assets, setAssets] = useState<Array<Record<string, unknown>>>([]);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch("/api/map/assets", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setAssets(d.assets || []));
    const id = sp.get("asset");
    if (id) {
      fetch(`/api/map/assets?assetId=${encodeURIComponent(id)}`, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => setDetail(d.asset || null));
    }
  }, [sp]);

  return (
    <AdminShell user={user}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Asset map</h1>
          <p className="text-xs text-muted">Configurable campus assets — only configured items appear.</p>
        </div>
        <Link href="/map?mode=ASSET" className="rounded border border-white/15 px-3 py-1.5 text-xs">
          Open on campus map
        </Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <ul className="divide-y divide-white/10 rounded-xl border border-border">
          {assets.map((a) => (
            <li key={String(a.assetId)}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-white/5"
                onClick={() =>
                  fetch(`/api/map/assets?assetId=${encodeURIComponent(String(a.assetId))}`, {
                    credentials: "include",
                  })
                    .then((r) => r.json())
                    .then((d) => setDetail(d.asset || null))
                }
              >
                <span>
                  {String(a.name)}
                  <span className="ml-2 text-xs text-muted">{String(a.type)}</span>
                </span>
                <span className="text-xs">{String(a.status)}</span>
              </button>
            </li>
          ))}
          {!assets.length && (
            <li className="px-4 py-8 text-center text-sm text-muted">No assets configured.</li>
          )}
        </ul>
        <aside className="rounded-xl border border-border p-4 text-xs">
          {!detail ? (
            <p className="text-muted">Select an asset.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-semibold">{String(detail.name)}</p>
              <p>Type: {String(detail.type)}</p>
              <p>Status: {String(detail.status)}</p>
              <p>Owner: {String(detail.owner || "—")}</p>
              <p>Last inspection: {String(detail.lastInspection || "—")}</p>
              <p className="text-muted">
                Location source:{" "}
                {String((detail.locationMeta as { source?: string } | undefined)?.source || "—")}
              </p>
            </div>
          )}
        </aside>
      </div>
    </AdminShell>
  );
}

export function AssetMapClient({ user }: { user: SafeUser }) {
  return (
    <Suspense fallback={<div className="p-8 text-sm">Loading…</div>}>
      <AssetMapInner user={user} />
    </Suspense>
  );
}
