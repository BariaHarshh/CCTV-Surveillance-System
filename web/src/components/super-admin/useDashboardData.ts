"use client";

import { useCallback, useEffect, useState } from "react";
import { platformConfig } from "@/lib/config/platform";
import { formatRelativeTime } from "@/lib/utils/time";

export interface DashboardData {
  statistics: {
    users: Record<string, number>;
    userStatusChart: { name: string; value: number; color: string }[];
    onlineChart: { name: string; value: number; color: string }[];
    organizations: Record<string, number>;
    admins: Record<string, number>;
    security: Record<string, number>;
  };
  activity: {
    id: string;
    description: string;
    actor: string;
    severity: string;
    createdAt: string;
  }[];
  organizations: {
    id: string;
    name: string;
    status: string;
    admins: number;
    staff: number;
    createdAt: string;
  }[];
  admins: {
    id: string;
    name: string;
    userId: string;
    status: string;
    organization: string;
    lastLogin: string | null;
  }[];
  systemHealth: {
    overall: "operational" | "degraded";
    database: string;
    authentication: string;
    api: string;
    sessions: string;
  };
  generatedAt: string;
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/super-admin/dashboard", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to load dashboard");
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, platformConfig.dashboardPollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchData]);

  const notifications =
    data?.activity.slice(0, 5).map((a) => ({
      id: a.id,
      description: a.description,
      time: formatRelativeTime(new Date(a.createdAt)),
    })) ?? [];

  return { data, loading, error, refetch: fetchData, notifications };
}
