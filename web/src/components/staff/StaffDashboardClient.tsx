"use client";

import { useEffect, useState } from "react";
import { StaffShell } from "./StaffShell";
import { StatCard, StatCardSkeleton } from "@/components/super-admin/StatCard";
import { Building2, Camera, User, Wifi } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils/time";
import type { SafeUser } from "@/lib/auth/sanitize-user";

export function StaffDashboardClient({ user }: { user: SafeUser }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/staff/dashboard", { credentials: "include" })
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const u = data?.user as Record<string, unknown> | undefined;
  const org = data?.organization as Record<string, string> | undefined;
  const prof = u?.professional as Record<string, string> | undefined;

  return (
    <StaffShell user={user}>
      <div>
        <h1 className="text-2xl font-bold lg:text-3xl">Welcome, {user.name}</h1>
        <p className="mt-1 text-muted">Your campus safety workspace</p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Organization" value={org?.name ?? "—"} icon={Building2} delay={0} />
            <StatCard label="Staff ID" value={user.userId} icon={User} delay={0.05} />
            <StatCard label="Department" value={prof?.department ?? "—"} icon={Building2} delay={0.1} />
            <StatCard label="Position" value={prof?.jobTitle ?? "—"} icon={User} delay={0.15} />
            <StatCard label="Account Status" value={String(u?.status ?? user.status)} icon={Wifi} delay={0.2} />
            <StatCard label="Last Login" value={u?.lastLogin ? formatRelativeTime(new Date(u.lastLogin as string)) : "—"} icon={Camera} delay={0.25} />
          </>
        )}
      </div>
    </StaffShell>
  );
}
