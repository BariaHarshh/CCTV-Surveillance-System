"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";
import { suggestEvacuationRoute } from "@/lib/map/routing";

export function EmergencyMapClient({ user }: { user: SafeUser }) {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [routeMsg, setRouteMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/map/emergency/${encodeURIComponent(params.id)}`, {
        credentials: "include",
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Failed to load emergency map");
        return;
      }
      setData(j.emergencyMap);
    })();
  }, [params.id]);

  const tryRoute = () => {
    const exits = (data?.exits as Array<{ location?: { lat: number; lng: number }; exitId: string; name: string; status: string }>) || [];
    const open = exits.filter((e) => e.status === "OPEN" && e.location);
    const area = data?.affectedArea as { point?: { lat: number; lng: number } | null };
    if (!area?.point || !open.length) {
      setRouteMsg("Route cannot be reliably calculated.");
      return;
    }
    const dest = open[0].location!;
    const result = suggestEvacuationRoute({
      start: area.point,
      destination: dest,
      nodes: [],
      edges: [],
    });
    setRouteMsg(result.message);
  };

  const emergency = data?.emergency as Record<string, unknown> | undefined;
  const affected = data?.affectedArea as Record<string, unknown> | undefined;

  return (
    <AdminShell user={user}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-red-400">
            Emergency map
          </p>
          <h1 className="text-xl font-semibold">
            {String(emergency?.type || "Emergency")} · {String(emergency?.emergencyId || params.id)}
          </h1>
          <p className="text-xs text-muted">
            Status {String(emergency?.status)} · Severity {String(emergency?.severity)}
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <Link href="/map?mode=EMERGENCY" className="rounded border border-white/15 px-3 py-1.5">
            Campus emergency mode
          </Link>
          <Link href="/admin/emergency" className="rounded border border-red-500/30 px-3 py-1.5 text-red-300">
            Emergency ops
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm">
          <h2 className="font-semibold">Affected area</h2>
          {affected?.kind ? (
            <div className="mt-2 space-y-1 text-xs">
              <p>Kind: {String(affected.kind)}</p>
              <p>Source: {String(affected.source)}</p>
              <p className="text-muted">Boundaries come only from verified configuration.</p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted">{String(affected?.message || "Not configured.")}</p>
          )}

          <button
            type="button"
            onClick={tryRoute}
            className="mt-4 rounded-lg border border-white/15 px-3 py-1.5 text-xs"
          >
            Suggest evacuation route
          </button>
          {routeMsg && (
            <p className="mt-2 text-xs text-amber-200">
              Recommendation: {routeMsg}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-border p-4 text-xs">
          <h2 className="mb-2 text-sm font-semibold">Exits</h2>
          <ul className="space-y-1">
            {((data?.exits as Array<Record<string, unknown>>) || []).map((e) => (
              <li key={String(e.exitId)}>
                {String(e.name)} — {String(e.status)}
                {e.accessible === false ? " (not accessible)" : ""}
              </li>
            ))}
            {!((data?.exits as unknown[]) || []).length && (
              <li className="text-muted">No emergency exits configured.</li>
            )}
          </ul>

          <h2 className="mb-2 mt-4 text-sm font-semibold">Assembly areas</h2>
          <ul className="space-y-1">
            {((data?.assemblyAreas as Array<Record<string, unknown>>) || []).map((a) => (
              <li key={String(a.assemblyId)}>
                {String(a.name)} — {String(a.status)}
              </li>
            ))}
          </ul>

          <h2 className="mb-2 mt-4 text-sm font-semibold">Response teams</h2>
          <ul className="space-y-1">
            {((data?.responseTeams as Array<Record<string, unknown>>) || []).map((t) => (
              <li key={String(t.teamId)}>
                {String(t.name)} — {String(t.status)}
                {t.liveTracking ? " · live tracking" : " · last known only"}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}
