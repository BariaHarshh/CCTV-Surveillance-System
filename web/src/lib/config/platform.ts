import { authConfig } from "@/lib/auth/config";

export const platformConfig = {
  onlineThresholdSeconds: parseInt(process.env.ONLINE_THRESHOLD_SECONDS ?? "120", 10),
  dashboardPollIntervalMs: parseInt(process.env.DASHBOARD_POLL_INTERVAL_MS ?? "30000", 10),
} as const;

export { authConfig };
