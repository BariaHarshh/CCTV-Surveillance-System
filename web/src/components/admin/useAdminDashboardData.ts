"use client";

import { useCallback, useEffect, useState } from "react";
import { useMonitoringSocket } from "@/hooks/useMonitoringSocket";

interface DashboardData {
  organization: { name: string; status: string };
  statistics: {
    staff: { total: number; active: number; inactive: number; suspended: number; pending: number; online: number; offline: number };
    campusUsers: number;
    activeAlerts: number;
    criticalAlerts: number;
    eventsToday: number;
    activeEvents: number;
    currentRisk: { score: number; level: string; label: string };
    organizationStatus: string;
    campus: {
      buildings: number;
      rooms: number;
      cameras: number;
      totalCapacity: number;
      occupancy: null;
      occupancyLabel: string;
    } | null;
    cameras: {
      total: number;
      online: number;
      offline: number;
      maintenance: number;
      error: number;
      connecting: number;
      disabled: number;
    };
  };
  staffOverview: { name: string; value: number; color: string }[];
  activity: { id: string; description: string; createdAt: string; action: string }[];
}

export function useAdminDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/dashboard", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load dashboard");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { status: realtimeStatus } = useMonitoringSocket({
    onAlertCreated: () => fetchData(),
    onAlertUpdated: () => fetchData(),
    onEventCreated: () => fetchData(),
    onCameraStatus: () => fetchData(),
  });

  const notifications =
    data?.activity.slice(0, 5).map((a) => ({
      id: a.id,
      description: a.description,
      time: a.createdAt,
    })) ?? [];

  return { data, loading, error, refetch: fetchData, notifications, realtimeStatus };
}
