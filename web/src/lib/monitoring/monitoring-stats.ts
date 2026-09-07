import { connectDB } from "@/lib/db/connect";
import { getCameraStatistics } from "@/lib/campus/camera-service";
import { getEventStatistics } from "@/lib/monitoring/event-service";
import { getAlertStatistics } from "@/lib/monitoring/alert-service";
import { riskLevelFromScore } from "@/lib/monitoring/constants";
import { Event } from "@/models/Event";
import { orgFilter } from "@/lib/campus/service";

export async function getMonitoringOverview(organizationId: string) {
  await connectDB();
  const [cameras, events, alerts] = await Promise.all([
    getCameraStatistics(organizationId),
    getEventStatistics(organizationId),
    getAlertStatistics(organizationId),
  ]);

  const recentCritical = await Event.find(
    orgFilter(organizationId, { severity: "CRITICAL", status: { $ne: "RESOLVED" } })
  )
    .sort({ detectedAt: -1 })
    .limit(1);

  const topRisk = recentCritical[0]?.riskScore ?? 0;

  return {
    cameras: {
      total: cameras.total,
      online: cameras.online,
      offline: cameras.offline + cameras.error + cameras.connecting,
      maintenance: cameras.maintenance,
      disabled: cameras.disabled,
    },
    events: {
      active: events.active,
      today: events.today,
      total: events.total,
    },
    alerts: {
      active: alerts.unresolved,
      critical: alerts.critical,
      high: alerts.high,
      medium: alerts.medium,
      low: alerts.low,
      new: alerts.new,
      unresolved: alerts.unresolved,
    },
    currentRisk: {
      score: topRisk,
      level: riskLevelFromScore(topRisk),
      label: topRisk > 0 ? `${topRisk} / 100` : "No active risk",
    },
  };
}
