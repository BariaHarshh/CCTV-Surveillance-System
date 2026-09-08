import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { orgFilter } from "@/lib/campus/service";
import { KpiDefinition, KpiSnapshot, newBiId } from "@/models/BI";
import {
  forecastSeries,
  kpiStatusFromValue,
  type KpiStatus,
} from "@/lib/bi/constants";
import { percentChange, trendFromChange } from "@/lib/analytics/constants";
import {
  getIncidentAnalytics,
  getCameraAnalytics,
  getResponseAnalytics,
  getIncidentTrend,
  calculateSafetyScore,
} from "@/lib/analytics/analytics-service";
import { listInspections } from "@/lib/mobile/ops-service";
import { getOperationsAnalytics } from "@/lib/mobile/field-service";
import { ResponseTask } from "@/models/ResponseTask";

type Period = "TODAY" | "7D" | "30D" | "90D" | "QUARTER" | "YEAR";

function periodToFilters(period: Period) {
  const to = new Date();
  const from = new Date(to);
  if (period === "TODAY") from.setHours(0, 0, 0, 0);
  else if (period === "7D") from.setDate(from.getDate() - 7);
  else if (period === "30D") from.setDate(from.getDate() - 30);
  else if (period === "90D") from.setDate(from.getDate() - 90);
  else if (period === "QUARTER") from.setMonth(from.getMonth() - 3);
  else from.setFullYear(from.getFullYear() - 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

function trendForMetric(
  change: number | null,
  samples: number,
  higherIsBetter: boolean
): (typeof import("@/lib/bi/constants").KPI_TRENDS)[number] {
  const t = trendFromChange(change, samples);
  if (t === "INSUFFICIENT_DATA") return "INSUFFICIENT_DATA";
  if (t === "STABLE") return "STABLE";
  if (higherIsBetter) {
    return t === "INCREASING" ? "IMPROVING" : "DECLINING";
  }
  return t === "DECREASING" ? "IMPROVING" : "DECLINING";
}

async function ensureDefaultKpis(organizationId: string) {
  await connectDB();
  const count = await KpiDefinition.countDocuments(orgFilter(organizationId));
  if (count > 0) return;
  const defaults = [
    {
      name: "Safety Performance Score",
      category: "SAFETY" as const,
      unit: "score",
      higherIsBetter: true,
      target: 80,
      warningThreshold: 60,
      criticalThreshold: 40,
      description: "Configured operational indicator — not objective real-world safety",
    },
    {
      name: "Open Incidents",
      category: "INCIDENTS" as const,
      unit: "count",
      higherIsBetter: false,
      target: 5,
      warningThreshold: 15,
      criticalThreshold: 30,
      description: "Open + investigating incidents",
    },
    {
      name: "Camera Availability",
      category: "CAMERAS" as const,
      unit: "%",
      higherIsBetter: true,
      target: 95,
      warningThreshold: 90,
      criticalThreshold: 80,
      description: "Online cameras / total",
    },
    {
      name: "Avg Acknowledgement Time",
      category: "RESPONSE" as const,
      unit: "seconds",
      higherIsBetter: false,
      target: 300,
      warningThreshold: 600,
      criticalThreshold: 1200,
      description: "Alert to acknowledgement",
    },
    {
      name: "Inspection Compliance",
      category: "COMPLIANCE" as const,
      unit: "%",
      higherIsBetter: true,
      target: 90,
      warningThreshold: 75,
      criticalThreshold: 50,
      description: "Completed inspections / scheduled in period",
    },
  ];
  for (const d of defaults) {
    await KpiDefinition.create({
      kpiId: newBiId("kpi"),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      ...d,
      source: "analytics-service",
    });
  }
}

export async function computeKpiPack(organizationId: string, period: Period = "30D") {
  await ensureDefaultKpis(organizationId);
  const filters = periodToFilters(period);
  const defs = await KpiDefinition.find(orgFilter(organizationId));

  const [safety, incidents, cameras, response, prevIncidents, ops, inspections] = await Promise.all([
    calculateSafetyScore(organizationId, filters),
    getIncidentAnalytics(organizationId, filters),
    getCameraAnalytics(organizationId, filters),
    getResponseAnalytics(organizationId, filters),
    getIncidentAnalytics(organizationId, {
      from: new Date(new Date(filters.from).getTime() - (new Date(filters.to).getTime() - new Date(filters.from).getTime())).toISOString(),
      to: filters.from,
    }),
    getOperationsAnalytics(organizationId).catch(() => null),
    listInspections(organizationId).catch(() => []),
  ]);

  const openIncidents = (incidents.open ?? 0) + (incidents.investigating ?? 0);
  const prevOpen = (prevIncidents.open ?? 0) + (prevIncidents.investigating ?? 0);
  const ackSec =
    response.alertToAcknowledgement?.avg != null
      ? Math.round(response.alertToAcknowledgement.avg / 1000)
      : null;

  const inspCompleted = inspections.filter((i: { status: string }) => i.status === "COMPLETED").length;
  const inspScheduled = inspections.length;
  const inspCompliance =
    inspScheduled > 0 ? Math.round((inspCompleted / inspScheduled) * 100) : null;

  const valueMap: Record<string, { value: number | null; previous: number | null; higherIsBetter: boolean }> = {
    "Safety Performance Score": {
      value: safety.overall,
      previous: null,
      higherIsBetter: true,
    },
    "Open Incidents": {
      value: openIncidents,
      previous: prevOpen,
      higherIsBetter: false,
    },
    "Camera Availability": {
      value: cameras.averageAvailability ?? null,
      previous: null,
      higherIsBetter: true,
    },
    "Avg Acknowledgement Time": {
      value: ackSec,
      previous: null,
      higherIsBetter: false,
    },
    "Inspection Compliance": {
      value: inspCompliance,
      previous: null,
      higherIsBetter: true,
    },
  };

  const snapshots = [];
  for (const def of defs) {
    const mapped = valueMap[def.name] ?? {
      value: null as number | null,
      previous: null as number | null,
      higherIsBetter: def.higherIsBetter,
    };
    const change = percentChange(mapped.value ?? 0, mapped.previous ?? 0);
    const status = kpiStatusFromValue(
      mapped.value,
      def.target,
      def.warningThreshold,
      def.criticalThreshold,
      def.higherIsBetter
    );
    const trend = trendForMetric(
      mapped.previous == null ? null : change,
      (mapped.value != null ? 1 : 0) + (mapped.previous != null ? 1 : 0),
      def.higherIsBetter
    );

    const snap = {
      snapshotId: newBiId("ks"),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      kpiId: def.kpiId,
      name: def.name,
      category: def.category,
      value: mapped.value,
      unit: def.unit,
      target: def.target,
      status: status as KpiStatus,
      trend,
      period,
      previousValue: mapped.previous,
      changePercent: mapped.previous == null ? null : change,
      source: def.source,
      computedAt: new Date(),
    };
    snapshots.push(snap);
    await KpiSnapshot.create(snap);
  }

  return {
    period,
    lastUpdated: new Date().toISOString(),
    freshness: "RECENT" as const,
    kpis: snapshots.map((s) => ({
      kpiId: s.kpiId,
      name: s.name,
      category: s.category,
      value: s.value,
      unit: s.unit,
      target: s.target,
      status: s.status,
      trend: s.trend,
      previousValue: s.previousValue,
      changePercent: s.changePercent,
      source: s.source,
      note: s.status === "NO_DATA" ? "NO DATA — insufficient source metrics" : null,
    })),
    belowTarget: snapshots.filter((s) => s.status === "ATTENTION" || s.status === "CRITICAL"),
    opsNote: ops?.disclaimer ?? null,
  };
}

export async function getIncidentForecast(organizationId: string) {
  const trend = await getIncidentTrend(organizationId, {
    from: new Date(Date.now() - 90 * 864e5).toISOString(),
    to: new Date().toISOString(),
    granularity: "day",
  });
  const series = ((trend.series as Array<{ count: number }>) || []).map((p) => p.count);
  const forecast = forecastSeries(series);
  return {
    historical: series.slice(-14),
    forecast: forecast.next,
    range: forecast.next == null ? null : { low: forecast.low, high: forecast.high },
    confidence: forecast.confidence,
    label: "FORECAST",
    disclaimer: forecast.disclaimer,
    source: "Incident Analytics",
    sourceHref: "/analytics/incidents",
  };
}

export async function getBenchmarkCampuses(organizationId: string) {
  // Single-org multi-campus: compare by building risk / incident counts when data exists
  const { getLocationRisk } = await import("@/lib/analytics/analytics-service");
  const risk = await getLocationRisk(organizationId, {
    from: new Date(Date.now() - 30 * 864e5).toISOString(),
    to: new Date().toISOString(),
  });
  const buildings = (risk.buildings ?? []) as Array<{
    location: string;
    events: number;
    riskScore: number;
  }>;
  if (buildings.length < 2) {
    return {
      comparable: false,
      message: "Not enough data for reliable comparison.",
      campuses: [],
    };
  }
  return {
    comparable: true,
    note: "Comparisons use incident counts and risk scores — not normalized for population unless configured",
    campuses: buildings.slice(0, 10).map((b) => ({
      name: b.location,
      incidentRate: b.events,
      riskScore: b.riskScore,
      href: `/map?q=${encodeURIComponent(b.location)}`,
    })),
  };
}

export async function detectExecutiveAnomalies(organizationId: string) {
  const { AnomalyDetectionService } = await import("@/lib/analytics/anomaly-service");
  const detected = await AnomalyDetectionService.detect(organizationId).catch(() => []);
  const pack = await computeKpiPack(organizationId, "30D");
  const fromKpis = pack.belowTarget.map((k) => ({
    metric: k.name,
    expected: k.target,
    observed: k.value,
    difference: k.changePercent,
    period: "30D",
    label: "POTENTIAL ANOMALY",
    note: "Informational — not an accusation or confirmed incident",
    possibleFactors: [] as string[],
  }));
  return {
    anomalies: [
      ...fromKpis,
      ...(Array.isArray(detected) ? detected : []).slice(0, 10).map((a: Record<string, unknown>) => ({
        metric: String(a.metric || a.name || "Metric"),
        expected: a.expected ?? null,
        observed: a.observed ?? a.value ?? null,
        difference: a.difference ?? null,
        period: String(a.period || "recent"),
        label: "POTENTIAL ANOMALY",
        note: "Informational — not an accusation or confirmed incident",
        possibleFactors: [],
      })),
    ],
  };
}

export async function getOperationalHealth(organizationId: string) {
  const [tasks, cameras, incidents, inspections] = await Promise.all([
    ResponseTask.find(orgFilter(organizationId)).limit(500),
    getCameraAnalytics(organizationId, periodToFilters("30D")),
    getIncidentAnalytics(organizationId, periodToFilters("30D")),
    listInspections(organizationId).catch(() => []),
  ]);
  const completed = tasks.filter((t) => t.status === "COMPLETED").length;
  const open = tasks.filter((t) => ["PENDING", "IN_PROGRESS", "PAUSED"].includes(t.status)).length;
  const taskRate = completed + open > 0 ? Math.round((completed / (completed + open)) * 100) : null;
  const inspDone = inspections.filter((i) => i.status === "COMPLETED").length;
  const inspRate = inspections.length ? Math.round((inspDone / inspections.length) * 100) : null;
  const openInc = (incidents.open ?? 0) + (incidents.investigating ?? 0);
  const parts = [
    taskRate,
    cameras.averageAvailability ?? null,
    inspRate,
    openInc == null ? null : Math.max(0, 100 - openInc * 5),
  ].filter((n): n is number => n != null);
  const score = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null;
  return {
    score,
    status: score == null ? "NO_DATA" : score >= 80 ? "GOOD" : score >= 60 ? "ATTENTION" : "CRITICAL",
    components: {
      taskCompletion: taskRate,
      cameraAvailability: cameras.averageAvailability ?? null,
      inspectionCompletion: inspRate,
      openIncidentsPenalty: openInc,
    },
    explanation:
      "Operational Health combines task completion, camera availability, inspection completion, and open incident load. It is an operational indicator — not a safety certification.",
  };
}

export async function getConfigurationReadiness(organizationId: string) {
  await connectDB();
  const { Campus } = await import("@/models/Campus");
  const { Building } = await import("@/models/Building");
  const { Camera } = await import("@/models/Camera");
  const { ResponseTeam } = await import("@/models/ResponseTeam");

  const [campuses, buildings, cameras, teams] = await Promise.all([
    Campus.countDocuments(orgFilter(organizationId)),
    Building.countDocuments(orgFilter(organizationId)),
    Camera.find(orgFilter(organizationId)),
    ResponseTeam.countDocuments(orgFilter(organizationId)),
  ]);

  const camsMissingLoc = cameras.filter((c) => !c.buildingId && !c.areaLabel).length;
  const checks = [
    { key: "Security", ok: teams > 0, detail: `${teams} response team(s)` },
    { key: "Operations", ok: buildings > 0, detail: `${buildings} building(s)` },
    { key: "Emergency", ok: campuses > 0, detail: `${campuses} campus(es)` },
    { key: "Cameras", ok: cameras.length > 0, detail: `${cameras.length} camera(s), ${camsMissingLoc} missing location` },
    { key: "Maps", ok: buildings > 0, detail: buildings > 0 ? "Buildings present" : "No buildings" },
    { key: "AI", ok: true, detail: "Uses existing AI configuration" },
    { key: "Notifications", ok: true, detail: "Uses existing notification system" },
    { key: "Governance", ok: true, detail: "Policies via enterprise module" },
  ];
  const ready = checks.filter((c) => c.ok).length;
  return {
    score: Math.round((ready / checks.length) * 100),
    categories: checks,
    issues: [
      ...(camsMissingLoc > 0
        ? [`${camsMissingLoc} cameras missing locations`]
        : []),
      ...(buildings === 0 ? ["Buildings not configured"] : []),
      ...(teams === 0 ? ["No response teams"] : []),
    ],
    disclaimer: "Configuration readiness is a setup indicator, not a safety certification.",
  };
}

export { periodToFilters };
