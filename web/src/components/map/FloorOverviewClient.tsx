"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";

export function FloorOverviewClient({ user }: { user: SafeUser }) {
  const params = useParams<{ id: string }>();
  const [plans, setPlans] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    fetch(`/api/map/floor-plans?floorId=${encodeURIComponent(params.id)}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => setPlans(d.floorPlans || []));
  }, [params.id]);

  const published = plans.find((p) => p.status === "PUBLISHED");

  return (
    <AdminShell user={user}>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Floor {params.id}</h1>
        <Link href="/map" className="rounded border border-white/15 px-3 py-1.5 text-xs">
          Campus map
        </Link>
      </div>
      <div className="min-h-[400px] rounded-xl border border-border bg-[#0b1220]">
        {published?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={String(published.imageUrl)} alt="Floor plan" className="max-h-[70vh] w-full object-contain" />
        ) : (
          <p className="p-8 text-sm text-muted">No published floor plan.</p>
        )}
      </div>
    </AdminShell>
  );
}
