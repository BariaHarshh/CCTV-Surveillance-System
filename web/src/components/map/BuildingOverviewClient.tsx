"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";

export function BuildingOverviewClient({ user }: { user: SafeUser }) {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch(`/api/map/buildings/${encodeURIComponent(params.id)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setData(d.building));
  }, [params.id]);

  const b = data?.building as Record<string, unknown> | undefined;

  return (
    <AdminShell user={user}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{String(b?.name || params.id)}</h1>
          <p className="text-xs text-muted">{String(b?.address || "")}</p>
        </div>
        <div className="flex gap-2 text-xs">
          <Link
            href={`/map?building=${encodeURIComponent(String(b?.buildingId || params.id))}`}
            className="rounded border border-white/15 px-3 py-1.5"
          >
            View on map
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4 text-sm">
        <div className="rounded-xl border border-border p-3">
          <p className="text-xs text-muted">Floors</p>
          <p className="text-xl font-semibold">{String(b?.floors ?? "—")}</p>
        </div>
        <div className="rounded-xl border border-border p-3">
          <p className="text-xs text-muted">Rooms</p>
          <p className="text-xl font-semibold">{String(data?.rooms ?? "—")}</p>
        </div>
        <div className="rounded-xl border border-border p-3">
          <p className="text-xs text-muted">Cameras</p>
          <p className="text-xl font-semibold">
            {String((data?.cameras as { total?: number } | undefined)?.total ?? "—")}
          </p>
        </div>
        <div className="rounded-xl border border-border p-3">
          <p className="text-xs text-muted">Risk</p>
          <p className="text-xl font-semibold">
            {String((data?.risk as { level?: string } | undefined)?.level ?? "INSUFFICIENT_DATA")}
          </p>
        </div>
      </div>

      <section className="mt-6 rounded-xl border border-border p-4">
        <h2 className="text-sm font-semibold">Risk factors</h2>
        <ul className="mt-2 list-disc pl-5 text-xs text-muted">
          {(((data?.risk as { factors?: string[] })?.factors) || ["Insufficient Data"]).map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-xl border border-border p-4">
        <h2 className="mb-2 text-sm font-semibold">Floors</h2>
        <ul className="space-y-2 text-xs">
          {((data?.floors as Array<Record<string, unknown>>) || []).map((f) => (
            <li key={String(f.floorId)}>
              <Link
                href={`/map/building/${encodeURIComponent(String(b?.buildingId || params.id))}/floor/${encodeURIComponent(String(f.floorId))}`}
                className="text-sky-400 hover:underline"
              >
                {String(f.name)} (level {String(f.level)})
              </Link>
              {" · "}
              <Link
                href={`/floor/${encodeURIComponent(String(f.floorId))}`}
                className="text-muted hover:underline"
              >
                Floor overview
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </AdminShell>
  );
}
