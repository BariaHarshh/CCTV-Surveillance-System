import { connectDB } from "@/lib/db/connect";
import { Event } from "@/models/Event";
import { Alert } from "@/models/Alert";
import { Incident } from "@/models/Incident";
import { Emergency } from "@/models/Emergency";
import { Camera } from "@/models/Camera";
import { ResponseTeam } from "@/models/ResponseTeam";
import { ResponseTask } from "@/models/ResponseTask";
import { EventFeedback } from "@/models/EventFeedback";
import { CorrectiveAction } from "@/models/CorrectiveAction";
import { ActiveEscalation } from "@/models/EscalationRule";
import { orgFilter } from "@/lib/campus/service";
import {
  type AnalyticsFilters,
  baseMatch,
  dateRange,
  emptyState,
  mean,
  median,
  orgId,
  percentile,
  previousPeriod,
} from "@/lib/analytics/filters";
import { percentChange, safetyScoreLabel, trendFromChange } from "@/lib/analytics/constants";
import { analyticsCache } from "@/lib/analytics/cache";
import { getAIHealthMetrics } from "@/lib/ai/health-service";
import { getOrCreateOrgEmergencyState } from "@/lib/emergency/emergency-service";
import { getSocketIO } from "@/lib/monitoring/socket-emitter";

const NON_TEST = { source: { $ne: "TEST" as const } };

export async function getIncidentAnalytics(organizationId: string, filters: AnalyticsFilters = {}) {
  await connectDB();
  const match = baseMatch(organizationId, filters, "startedAt");
  if (filters.incidentStatus) match.status = filters.incidentStatus;

  const [byStatus, bySeverity, total] = await Promise.all([
    Incident.aggregate([{ $match: match }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Incident.aggregate([{ $match: match }, { $group: { _id: "$severity", count: { $sum: 1 } } }]),
    Incident.countDocuments(match),
  ]);

  if (total === 0) {
    return {
      ...emptyState(),
      total: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      open: 0,
      investigating: 0,
      contained: 0,
      resolved: 0,
      dismissed: 0,
      byStatus: {},
      bySeverity: {},
    };
  }

  const statusMap: Record<string, number> = {};
  for (const r of byStatus) statusMap[r._id] = r.count;
  const severityMap: Record<string, number> = {};
  for (const r of bySeverity) severityMap[r._id] = r.count;

  return {
    empty: false,
    total,
    critical: severityMap.CRITICAL ?? 0,
    high: severityMap.HIGH ?? 0,
    medium: severityMap.MEDIUM ?? 0,
    low: severityMap.LOW ?? 0,
    open: statusMap.OPEN ?? 0,
    investigating: statusMap.INVESTIGATING ?? 0,
    contained: statusMap.CONTAINED ?? 0,
    resolved: statusMap.RESOLVED ?? 0,
    dismissed: statusMap.DISMISSED ?? 0,
    byStatus: statusMap,
    bySeverity: severityMap,
  };
}

export async function getIncidentTrend(organizationId: string, filters: AnalyticsFilters = {}) {
  await connectDB();
  const match = baseMatch(organizationId, filters, "startedAt");
  const granularity = filters.granularity ?? "day";
  const format =
    granularity === "month" ? "%Y-%m" : granularity === "week" ? "%G-W%V" : "%Y-%m-%d";

  const series = await Incident.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format, date: "$startedAt" } },
        count: { $sum: 1 },
        critical: { $sum: { $cond: [{ $eq: ["$severity", "CRITICAL"] }, 1, 0] } },
        high: { $sum: { $cond: [{ $eq: ["$severity", "HIGH"] }, 1, 0] } },
        medium: { $sum: { $cond: [{ $eq: ["$severity", "MEDIUM"] }, 1, 0] } },
        low: { $sum: { $cond: [{ $eq: ["$severity", "LOW"] }, 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  if (series.length === 0) return { ...emptyState(), series: [] };
  return {
    empty: false,
    granularity,
    series: series.map((s) => ({
      period: s._id,
      count: s.count,
      critical: s.critical,
      high: s.high,
      medium: s.medium,
      low: s.low,
    })),
  };
}

export async function getEventTypeDistribution(organizationId: string, filters: AnalyticsFilters = {}) {
  await connectDB();
  const match = baseMatch(organizationId, filters, "detectedAt");
  const rows = await Event.aggregate([
    { $match: match },
    { $group: { _id: "$eventType", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  if (rows.length === 0) return { ...emptyState(), items: [] };
  return {
    empty: false,
    items: rows.map((r) => ({ eventType: r._id, count: r.count })),
  };
}

export async function getAlertAnalytics(organizationId: string, filters: AnalyticsFilters = {}) {
  await connectDB();
  const match = baseMatch(organizationId, filters, "createdAt");
  const [total, bySeverity, byStatus, times] = await Promise.all([
    Alert.countDocuments(match),
    Alert.aggregate([{ $match: match }, { $group: { _id: "$severity", count: { $sum: 1 } } }]),
    Alert.aggregate([{ $match: match }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Alert.find({ ...match, acknowledgedAt: { $ne: null } })
      .select("createdAt acknowledgedAt resolvedAt dismissedAt status")
      .limit(2000)
      .lean(),
  ]);

  if (total === 0) return { ...emptyState(), total: 0 };

  const severityMap: Record<string, number> = {};
  for (const r of bySeverity) severityMap[r._id] = r.count;
  const statusMap: Record<string, number> = {};
  for (const r of byStatus) statusMap[r._id] = r.count;

  const ackMs: number[] = [];
  for (const a of times) {
    if (a.acknowledgedAt && a.createdAt) {
      ackMs.push(new Date(a.acknowledgedAt).getTime() - new Date(a.createdAt).getTime());
    }
  }

  const acknowledged = (statusMap.ACKNOWLEDGED ?? 0) + (statusMap.INVESTIGATING ?? 0) + (statusMap.RESOLVED ?? 0);
  const dismissed = statusMap.DISMISSED ?? 0;
  const resolved = statusMap.RESOLVED ?? 0;

  return {
    empty: false,
    total,
    critical: severityMap.CRITICAL ?? 0,
    high: severityMap.HIGH ?? 0,
    medium: severityMap.MEDIUM ?? 0,
    low: severityMap.LOW ?? 0,
    acknowledged,
    unacknowledged: statusMap.NEW ?? 0,
    resolved,
    dismissed,
    bySeverity: severityMap,
    byStatus: statusMap,
    acknowledgementRate: total ? Math.round((acknowledged / total) * 1000) / 10 : null,
    resolutionRate: total ? Math.round((resolved / total) * 1000) / 10 : null,
    dismissalRate: total ? Math.round((dismissed / total) * 1000) / 10 : null,
    avgAcknowledgementMs: mean(ackMs),
  };
}

export async function getAlertVolume(organizationId: string, filters: AnalyticsFilters = {}) {
  await connectDB();
  const match = baseMatch(organizationId, filters, "createdAt");
  const [perDay, perType, repeated] = await Promise.all([
    Alert.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Alert.aggregate([{ $match: match }, { $group: { _id: "$type", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Alert.aggregate([
      { $match: match },
      { $group: { _id: { camera: "$location.cameraPublicId", type: "$type" }, count: { $sum: 1 } } },
      { $match: { count: { $gte: 3 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
  ]);

  if (perDay.length === 0) return { ...emptyState(), perDay: [], perType: [], repeated: [] };
  return {
    empty: false,
    perDay: perDay.map((d) => ({ date: d._id, count: d.count })),
    perType: perType.map((d) => ({ type: d._id, count: d.count })),
    repeated: repeated.map((d) => ({ camera: d._id.camera, type: d._id.type, count: d.count })),
  };
}

export async function getCameraAnalytics(organizationId: string, filters: AnalyticsFilters = {}) {
  await connectDB();
  const cameras = await Camera.find(orgFilter(organizationId)).lean();
  if (cameras.length === 0) return { ...emptyState("No cameras configured."), total: 0 };

  const byStatus: Record<string, number> = {};
  for (const c of cameras) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;

  const online = byStatus.ONLINE ?? 0;
  const offline = byStatus.OFFLINE ?? 0;
  const maintenance = byStatus.MAINTENANCE ?? 0;
  const availability = cameras.length ? Math.round((online / cameras.length) * 1000) / 10 : null;

  const tamperMatch = baseMatch(organizationId, { ...filters, eventType: "CAMERA_TAMPERED" }, "detectedAt");
  const tamperEvents = await Event.countDocuments(tamperMatch);

  // Per-camera availability from current status only (no historical telemetry → Insufficient data note)
  const perCamera = cameras.map((c) => ({
    id: c._id.toString(),
    cameraId: c.cameraId,
    name: c.name,
    status: c.status,
    availability: c.status === "ONLINE" ? 100 : c.status === "OFFLINE" ? 0 : null,
    availabilityNote: "Current status snapshot — historical uptime telemetry not available",
  }));

  return {
    empty: false,
    total: cameras.length,
    online,
    offline,
    maintenance,
    averageAvailability: availability,
    tamperEvents,
    streamErrors: offline,
    perCamera,
    insufficientHistoricalUptime: true,
  };
}

export async function getAIAnalytics(organizationId: string, filters: AnalyticsFilters = {}) {
  await connectDB();
  const match = baseMatch(organizationId, filters, "detectedAt");
  const [events, feedback, health] = await Promise.all([
    Event.countDocuments({
      ...match,
      ...(filters.includeTest ? {} : { source: { $in: ["DETECTION" as const, "SYSTEM" as const] } }),
    }),
    EventFeedback.aggregate([
      { $match: { organizationId: orgId(organizationId) } },
      { $group: { _id: "$feedbackType", count: { $sum: 1 } } },
    ]),
    getAIHealthMetrics(organizationId),
  ]);

  const feedbackMap: Record<string, number> = {};
  let feedbackTotal = 0;
  for (const f of feedback) {
    feedbackMap[f._id] = f.count;
    feedbackTotal += f.count;
  }

  const truePositive = feedbackMap.CORRECT ?? 0;
  const falsePositive = feedbackMap.FALSE_POSITIVE ?? 0;
  const precisionEstimate =
    feedbackTotal >= 10 && truePositive + falsePositive > 0
      ? Math.round((truePositive / (truePositive + falsePositive)) * 1000) / 10
      : null;

  return {
    empty: events === 0 && feedbackTotal === 0,
    message: events === 0 && feedbackTotal === 0 ? "No data available for this period." : undefined,
    detectionEvents: events,
    feedback: {
      correct: truePositive,
      falsePositive,
      incorrectEventType: feedbackMap.INCORRECT_EVENT_TYPE ?? 0,
      incorrectSeverity: feedbackMap.INCORRECT_SEVERITY ?? 0,
      total: feedbackTotal,
    },
    precisionEstimate,
    precisionNote:
      precisionEstimate == null
        ? "Not enough feedback data."
        : "Feedback-based precision estimate only — not a validated model accuracy claim.",
    health,
    // Same-org model registry comparison only — not cross-dataset accuracy claims
    modelComparison: (health?.models ?? []).map((m: { name?: string; provider?: string; status?: string }) => ({
      model: m.name ?? m.provider ?? "Unknown",
      events: null as number | null,
      falsePositiveRate: null as number | null,
      latency: health?.metrics?.averageDetectionLatencyMs ?? null,
      availability: m.status ?? "UNKNOWN",
      note: "Per-model event splits require provider tagging on events; availability from health registry.",
    })),
    activeModels: (health?.models ?? []).length,
    detectionAvailability: (health?.services ?? []).map((s: { name: string; status: string }) => ({
      name: s.name,
      status: s.status,
    })),
  };
}

export async function getResponseAnalytics(organizationId: string, filters: AnalyticsFilters = {}) {
  await connectDB();
  const match = baseMatch(organizationId, filters, "createdAt");
  const alerts = await Alert.find({
    ...match,
    status: { $in: ["ACKNOWLEDGED", "INVESTIGATING", "RESOLVED"] },
  })
    .select("createdAt acknowledgedAt resolvedAt")
    .limit(2000)
    .lean();

  if (alerts.length === 0) {
    return { ...emptyState("Insufficient incident history."), samples: 0 };
  }

  const ackTimes: number[] = [];
  const resolveTimes: number[] = [];
  for (const a of alerts) {
    if (a.acknowledgedAt) ackTimes.push(new Date(a.acknowledgedAt).getTime() - new Date(a.createdAt).getTime());
    if (a.resolvedAt) resolveTimes.push(new Date(a.resolvedAt).getTime() - new Date(a.createdAt).getTime());
  }
  ackTimes.sort((a, b) => a - b);
  resolveTimes.sort((a, b) => a - b);

  const incidents = await Incident.find(baseMatch(organizationId, filters, "startedAt"))
    .select("startedAt resolvedAt")
    .limit(2000)
    .lean();
  const durations = incidents
    .filter((i) => i.resolvedAt)
    .map((i) => new Date(i.resolvedAt!).getTime() - new Date(i.startedAt).getTime())
    .sort((a, b) => a - b);

  return {
    empty: false,
    samples: alerts.length,
    detectionToAlert: null as number | null, // not separately timed in current schema
    alertToAcknowledgement: {
      avg: mean(ackTimes),
      median: median(ackTimes),
      p95: percentile(ackTimes, 95),
    },
    responseToResolution: {
      avg: mean(resolveTimes),
      median: median(resolveTimes),
      p95: percentile(resolveTimes, 95),
    },
    totalIncidentDuration: {
      avg: mean(durations),
      median: median(durations),
      p95: percentile(durations, 95),
      samples: durations.length,
    },
  };
}

export async function getEmergencyAnalytics(organizationId: string, filters: AnalyticsFilters = {}) {
  await connectDB();
  const match = baseMatch(organizationId, filters, "activatedAt");
  if (filters.emergencyType) match.type = filters.emergencyType;

  const escFilter = orgFilter(organizationId, filters.includeTest ? {} : NON_TEST);
  const [total, byType, bySeverity, items, escalations, escalationRows] = await Promise.all([
    Emergency.countDocuments(match),
    Emergency.aggregate([{ $match: match }, { $group: { _id: "$type", count: { $sum: 1 } } }]),
    Emergency.aggregate([{ $match: match }, { $group: { _id: "$severity", count: { $sum: 1 } } }]),
    Emergency.find(match).select("activatedAt resolvedAt status").lean(),
    ActiveEscalation.countDocuments(escFilter),
    ActiveEscalation.find(escFilter).select("levelIndex history acknowledgedAt createdAt status currentLevel").lean(),
  ]);

  if (total === 0 && escalations === 0) return { ...emptyState(), total: 0 };

  const durations = items
    .filter((e) => e.resolvedAt)
    .map((e) => new Date(e.resolvedAt!).getTime() - new Date(e.activatedAt).getTime());
  const resolved = items.filter((e) => e.status === "RESOLVED").length;
  const unresolved = items.filter((e) => e.status === "ACTIVE" || e.status === "CONTAINED").length;

  const byLevel = { level1: 0, level2: 0, level3: 0, level4: 0 };
  let timeoutCount = 0;
  const escTimes: number[] = [];
  let ackBeforeEscalation = 0;
  for (const esc of escalationRows) {
    const idx = Math.min(Math.max(esc.levelIndex ?? 0, 0), 3);
    if (idx === 0) byLevel.level1 += 1;
    else if (idx === 1) byLevel.level2 += 1;
    else if (idx === 2) byLevel.level3 += 1;
    else byLevel.level4 += 1;
    if (esc.status === "TIMED_OUT") timeoutCount += 1;
    if (esc.history?.[0]?.triggeredAt && esc.createdAt) {
      escTimes.push(new Date(esc.history[0].triggeredAt).getTime() - new Date(esc.createdAt).getTime());
    }
    if (esc.acknowledgedAt && (esc.levelIndex ?? 0) === 0) ackBeforeEscalation += 1;
  }

  return {
    empty: false,
    total,
    byType: Object.fromEntries(byType.map((r) => [r._id, r.count])),
    bySeverity: Object.fromEntries(bySeverity.map((r) => [r._id, r.count])),
    averageDurationMs: mean(durations),
    resolutionRate: total ? Math.round((resolved / total) * 1000) / 10 : null,
    escalations,
    unresolved,
    escalationAnalytics: {
      total: escalationRows.length,
      ...byLevel,
      timeoutRate: escalationRows.length
        ? Math.round((timeoutCount / escalationRows.length) * 1000) / 10
        : null,
      averageEscalationMs: mean(escTimes),
      acknowledgedBeforeEscalation: ackBeforeEscalation,
    },
    trend: await Emergency.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$activatedAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]).then((rows) => rows.map((r) => ({ period: r._id, count: r.count }))),
  };
}

export async function getLocationRisk(organizationId: string, filters: AnalyticsFilters = {}) {
  await connectDB();
  const match = baseMatch(organizationId, filters, "startedAt");

  const byBuilding = await Incident.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $ifNull: ["$location.building", "Unknown"] },
        events: { $sum: 1 },
        critical: { $sum: { $cond: [{ $eq: ["$severity", "CRITICAL"] }, 1, 0] } },
        avgRisk: { $avg: "$riskScore" },
      },
    },
    { $sort: { events: -1 } },
    { $limit: 20 },
  ]);

  const byRoom = await Incident.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $ifNull: ["$location.room", "Unknown"] },
        events: { $sum: 1 },
        critical: { $sum: { $cond: [{ $eq: ["$severity", "CRITICAL"] }, 1, 0] } },
        avgRisk: { $avg: "$riskScore" },
      },
    },
    { $sort: { events: -1 } },
    { $limit: 20 },
  ]);

  const byCamera = await Incident.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $ifNull: ["$location.camera", "Unknown"] },
        events: { $sum: 1 },
        critical: { $sum: { $cond: [{ $eq: ["$severity", "CRITICAL"] }, 1, 0] } },
        avgRisk: { $avg: "$riskScore" },
      },
    },
    { $sort: { events: -1 } },
    { $limit: 20 },
  ]);

  if (byBuilding.length === 0 && byRoom.length === 0 && byCamera.length === 0) {
    return { ...emptyState(), buildings: [], rooms: [], cameras: [] };
  }

  const mapRows = (rows: Array<{ _id: string; events: number; critical: number; avgRisk: number }>) =>
    rows.map((r) => ({
      location: r._id,
      events: r.events,
      critical: r.critical,
      riskScore: Math.round(r.avgRisk ?? 0),
      trend: "INSUFFICIENT_DATA" as const,
      note: "Risk score is average configured incident risk — not a prediction of danger.",
    }));

  return {
    empty: false,
    buildings: mapRows(byBuilding),
    rooms: mapRows(byRoom),
    cameras: mapRows(byCamera),
    heatmap: byBuilding.map((b) => ({
      building: b._id,
      intensity: b.events,
      critical: b.critical,
    })),
  };
}

export async function getTeamAnalytics(organizationId: string, filters: AnalyticsFilters = {}) {
  await connectDB();
  const { from, to } = dateRange(filters);
  const teams = await ResponseTeam.find(orgFilter(organizationId)).lean();
  if (teams.length === 0) return { ...emptyState("No response teams configured."), teams: [] };

  const tasks = await ResponseTask.find({
    organizationId: orgId(organizationId),
    createdAt: { $gte: from, $lte: to },
    ...(filters.includeTest ? {} : NON_TEST),
  }).lean();

  const rows = teams.map((t) => {
    const teamTasks = tasks.filter((task) => task.assignedTeam?.toString() === t._id.toString());
    const completed = teamTasks.filter((x) => x.status === "COMPLETED");
    const open = teamTasks.filter((x) => x.status === "PENDING" || x.status === "IN_PROGRESS");
    const durations = completed
      .filter((x) => x.completedAt)
      .map((x) => new Date(x.completedAt!).getTime() - new Date(x.createdAt).getTime());
    return {
      id: t._id.toString(),
      name: t.name,
      type: t.type,
      assigned: teamTasks.length,
      completed: completed.length,
      open: open.length,
      avgResponseMs: mean(durations),
      completionRate: teamTasks.length ? Math.round((completed.length / teamTasks.length) * 1000) / 10 : null,
    };
  });

  return { empty: false, teams: rows };
}

export async function calculateSafetyScore(organizationId: string, filters: AnalyticsFilters = {}) {
  await connectDB();
  const cacheKey = analyticsCache.buildKey(organizationId, "safetyScore", filters as Record<string, unknown>);
  const cached = analyticsCache.get<ReturnType<typeof formatScore>>(cacheKey);
  if (cached) return cached;

  const [incidents, alerts, cameras, emergencies, actions, health] = await Promise.all([
    getIncidentAnalytics(organizationId, filters),
    getAlertAnalytics(organizationId, filters),
    getCameraAnalytics(organizationId, filters),
    getEmergencyAnalytics(organizationId, filters),
    CorrectiveAction.find(orgFilter(organizationId, filters.includeTest ? {} : NON_TEST)).lean(),
    getAIHealthMetrics(organizationId),
  ]);

  // Component scores 0–100 (configured formula — not objective campus safety)
  const incidentTotal = incidents.total || 0;
  const criticalRate = incidentTotal
    ? ((incidents.critical ?? 0) + (incidents.high ?? 0)) / incidentTotal
    : 0;
  const openRate = incidentTotal ? ((incidents.open ?? 0) + (incidents.investigating ?? 0)) / incidentTotal : 0;
  const incidentPerformance = Math.max(0, Math.round(100 - criticalRate * 50 - openRate * 30 - Math.min(incidentTotal, 50)));

  const resolutionRate = alerts.resolutionRate ?? 50;
  const ackRate = alerts.acknowledgementRate ?? 50;
  const responsePerformance = Math.round(resolutionRate * 0.5 + ackRate * 0.5);

  const cameraAvailability = cameras.averageAvailability ?? 50;
  const degradedServices = (health?.services ?? []).filter((s) => s.status === "DEGRADED" || s.status === "DOWN").length;
  const aiHealthScore = degradedServices === 0 ? 100 : Math.max(30, 100 - degradedServices * 20);
  const systemAvailability = Math.round(cameraAvailability * 0.7 + aiHealthScore * 0.3);

  const emergencyPenalty = Math.min(40, (emergencies.total || 0) * 8);
  const riskControl = Math.max(0, 100 - emergencyPenalty - Math.round(criticalRate * 40));

  const completedActions = actions.filter((a) => a.status === "COMPLETED").length;
  const openActions = actions.filter((a) => a.status === "OPEN" || a.status === "IN_PROGRESS" || a.status === "OVERDUE").length;
  const actionTotal = completedActions + openActions;
  const correctiveActions = actionTotal
    ? Math.round((completedActions / actionTotal) * 100)
    : 80; // neutral when no actions

  const overall = Math.round(
    incidentPerformance * 0.25 +
      responsePerformance * 0.25 +
      systemAvailability * 0.2 +
      riskControl * 0.15 +
      correctiveActions * 0.15
  );

  const result = formatScore({
    overall: Math.min(100, Math.max(0, overall)),
    components: {
      incidentPerformance,
      responsePerformance,
      cameraAvailability: systemAvailability,
      riskControl,
      correctiveActions,
    },
    factors: buildScoreFactors({
      incidentPerformance,
      responsePerformance,
      systemAvailability,
      riskControl,
      correctiveActions,
      criticalIncidents: incidents.critical ?? 0,
      cameraAvailability: cameras.averageAvailability ?? null,
    }),
  });

  analyticsCache.set(cacheKey, result, 45);
  return result;
}

function formatScore(input: {
  overall: number;
  components: Record<string, number>;
  factors: string[];
}) {
  return {
    label: "Configured Safety Performance Score",
    disclaimer:
      "This score is a configured performance indicator based on platform metrics. It is not an objective measure of campus safety or a prediction of future incidents.",
    overall: input.overall,
    level: safetyScoreLabel(input.overall),
    components: input.components,
    factors: input.factors,
  };
}

function buildScoreFactors(c: {
  incidentPerformance: number;
  responsePerformance: number;
  systemAvailability: number;
  riskControl: number;
  correctiveActions: number;
  criticalIncidents: number;
  cameraAvailability: number | null;
}): string[] {
  const factors: string[] = [];
  if (c.criticalIncidents > 0) factors.push(`↓ ${c.criticalIncidents} high-severity incident(s) in period`);
  if (c.responsePerformance >= 80) factors.push("↑ Faster acknowledgement / resolution performance");
  if ((c.cameraAvailability ?? 0) >= 95) factors.push("↑ Strong camera availability");
  if (c.cameraAvailability != null && c.cameraAvailability < 90) factors.push("↓ Reduced camera availability");
  if (c.riskControl < 70) factors.push("↓ Elevated emergency / critical rate");
  if (c.correctiveActions >= 80) factors.push("↑ Corrective action closure");
  if (factors.length === 0) factors.push("Stable metrics relative to configured baselines");
  return factors;
}

export async function getAnalyticsOverview(organizationId: string, filters: AnalyticsFilters = {}) {
  await connectDB();
  const cacheKey = analyticsCache.buildKey(organizationId, "overview", filters as Record<string, unknown>);
  const cached = analyticsCache.get<Awaited<ReturnType<typeof buildOverview>>>(cacheKey);
  if (cached) return cached;
  const result = await buildOverview(organizationId, filters);
  analyticsCache.set(cacheKey, result, 30);
  return result;
}

async function buildOverview(organizationId: string, filters: AnalyticsFilters) {
  const { from, to } = dateRange(filters);
  const prev = previousPeriod(from, to);
  const prevFilters = { ...filters, from: prev.from.toISOString(), to: prev.to.toISOString() };

  const [incidents, prevIncidents, alerts, cameras, emergencies, safetyScore, response, locations] =
    await Promise.all([
      getIncidentAnalytics(organizationId, filters),
      getIncidentAnalytics(organizationId, prevFilters),
      getAlertAnalytics(organizationId, filters),
      getCameraAnalytics(organizationId, filters),
      getEmergencyAnalytics(organizationId, filters),
      calculateSafetyScore(organizationId, filters),
      getResponseAnalytics(organizationId, filters),
      getLocationRisk(organizationId, filters),
    ]);

  const incidentChange = percentChange(incidents.total ?? 0, prevIncidents.total ?? 0);
  const criticalChange = percentChange(incidents.critical ?? 0, prevIncidents.critical ?? 0);

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    previousPeriod: { from: prev.from.toISOString(), to: prev.to.toISOString() },
    safetyScore,
    incidents,
    alerts,
    cameras,
    emergencies,
    response,
    comparison: {
      incidents: { current: incidents.total, previous: prevIncidents.total, changePercent: incidentChange, trend: trendFromChange(incidentChange, incidents.total + prevIncidents.total) },
      critical: { current: incidents.critical, previous: prevIncidents.critical, changePercent: criticalChange, trend: trendFromChange(criticalChange, incidents.critical + prevIncidents.critical) },
    },
    topRiskAreas: (locations.buildings ?? []).slice(0, 5),
    empty: incidents.total === 0 && alerts.total === 0 && (emergencies.total ?? 0) === 0,
    message:
      incidents.total === 0 && alerts.total === 0 && (emergencies.total ?? 0) === 0
        ? "No data available for this period."
        : undefined,
  };
}

export async function getExecutiveOverview(organizationId: string, filters: AnalyticsFilters = {}) {
  const overview = await getAnalyticsOverview(organizationId, filters);
  const state = await getOrCreateOrgEmergencyState(organizationId);

  const majorInsights: Array<{ title: string; evidence: string[]; change: string | null }> = [];
  if (overview.comparison.critical.changePercent != null) {
    majorInsights.push({
      title:
        overview.comparison.critical.changePercent <= 0
          ? "High-severity incidents decreased"
          : "High-severity incidents increased",
      evidence: [
        `${overview.comparison.critical.current} critical this period`,
        `${overview.comparison.critical.previous} critical previous period`,
      ],
      change: `${overview.comparison.critical.changePercent > 0 ? "+" : ""}${overview.comparison.critical.changePercent}%`,
    });
  }
  if (overview.cameras.averageAvailability != null) {
    majorInsights.push({
      title: "Camera availability",
      evidence: [`${overview.cameras.averageAvailability}% cameras online`],
      change: null,
    });
  }
  if (overview.topRiskAreas[0]) {
    majorInsights.push({
      title: "Primary risk area",
      evidence: [
        `${overview.topRiskAreas[0].location}: ${overview.topRiskAreas[0].events} incidents`,
        `Avg risk score ${overview.topRiskAreas[0].riskScore}`,
      ],
      change: null,
    });
  }

  return {
    safetyScore: overview.safetyScore,
    campusMode: state.mode,
    activeIncidents: (overview.incidents.open ?? 0) + (overview.incidents.investigating ?? 0),
    criticalAlerts: overview.alerts.critical,
    openEmergencies: overview.emergencies.unresolved ?? 0,
    averageResponseMs: overview.response.alertToAcknowledgement?.avg ?? null,
    resolutionRate: overview.alerts.resolutionRate,
    cameraAvailability: overview.cameras.averageAvailability,
    aiHealth: overview.safetyScore.components,
    incidentTrend: overview.comparison.incidents,
    topRiskAreas: overview.topRiskAreas,
    majorInsights,
    summary: {
      overallPerformance: overview.safetyScore.level.replace(/_/g, " "),
      keyChange:
        overview.comparison.critical.changePercent != null
          ? `High-severity incidents ${overview.comparison.critical.changePercent <= 0 ? "decreased" : "increased"} ${Math.abs(overview.comparison.critical.changePercent)}%.`
          : "Insufficient data for period comparison.",
      primaryRiskArea: overview.topRiskAreas[0]?.location ?? "None identified",
      response:
        overview.response.alertToAcknowledgement?.avg != null
          ? `Average acknowledgement ${Math.round(overview.response.alertToAcknowledgement.avg / 1000)}s`
          : "Insufficient response history.",
      system: `Camera availability ${overview.cameras.averageAvailability ?? "—"}%`,
    },
    empty: overview.empty,
    message: overview.message,
    period: overview.period,
  };
}

export async function getDataQuality(organizationId: string) {
  await connectDB();
  const [cameras, events, incidents, alerts] = await Promise.all([
    Camera.find(orgFilter(organizationId)).lean(),
    Event.find(orgFilter(organizationId, NON_TEST)).sort({ detectedAt: -1 }).limit(500).lean(),
    Incident.find(orgFilter(organizationId, NON_TEST)).limit(500).lean(),
    Alert.find(orgFilter(organizationId, NON_TEST)).limit(500).lean(),
  ]);

  const missingLocations = cameras.filter((c) => !c.buildingId && !c.roomId && !c.areaLabel).length;
  const eventsWithoutConfidence = events.filter((e) => e.confidence == null).length;
  const eventsWithoutEvidence = events.filter((e) => !e.snapshot).length;
  const unresolvedIncidents = incidents.filter((i) => ["OPEN", "INVESTIGATING", "CONTAINED"].includes(i.status)).length;
  const missingResponse = alerts.filter((a) => a.status === "NEW").length;

  const totalChecks = cameras.length + events.length + incidents.length + alerts.length || 1;
  const issues =
    missingLocations +
    eventsWithoutConfidence +
    eventsWithoutEvidence +
    unresolvedIncidents +
    missingResponse;
  const completeness = Math.max(0, Math.round(100 - (issues / totalChecks) * 100));

  return {
    score: completeness,
    components: {
      completeness,
      consistency: eventsWithoutConfidence === 0 ? 100 : Math.max(40, 100 - eventsWithoutConfidence),
      validity: 90,
      timeliness: missingResponse === 0 ? 100 : Math.max(40, 100 - missingResponse),
      duplication: 95,
    },
    issues: {
      missingCameraLocations: missingLocations,
      eventsWithoutConfidence,
      eventsWithoutEvidence,
      unresolvedIncidents,
      missingResponseData: missingResponse,
      invalidConfigurations: 0,
      duplicateEvents: 0,
    },
    warning:
      completeness < 70
        ? "Analytics may be less reliable because source data is incomplete."
        : null,
  };
}

export async function getPlatformAnalytics() {
  await connectDB();
  const { Organization } = await import("@/models/Organization");
  const [orgs, cameras, events, alerts, emergencies] = await Promise.all([
    Organization.countDocuments({ deletedAt: null }),
    Camera.countDocuments({}),
    Event.countDocuments(NON_TEST),
    Alert.countDocuments(NON_TEST),
    Emergency.countDocuments({ status: { $in: ["ACTIVE", "CONTAINED"] }, ...NON_TEST }),
  ]);
  const online = await Camera.countDocuments({ status: "ONLINE" });
  const activeOrgs = await Organization.countDocuments({ deletedAt: null, status: "ACTIVE" });

  return {
    organizationsTotal: orgs,
    organizationsActive: activeOrgs,
    camerasTotal: cameras,
    camerasOnline: online,
    eventsTotal: events,
    alertsTotal: alerts,
    activeEmergencies: emergencies,
    systemHealth: {
      websocket: getSocketIO() ? "HEALTHY" : "DEGRADED",
      database: "HEALTHY",
      overall: getSocketIO() ? "HEALTHY" : "DEGRADED",
    },
  };
}

export const analyticsService = {
  overview: getAnalyticsOverview,
  executive: getExecutiveOverview,
  incidents: getIncidentAnalytics,
  incidentTrend: getIncidentTrend,
  eventTypes: getEventTypeDistribution,
  alerts: getAlertAnalytics,
  alertVolume: getAlertVolume,
  cameras: getCameraAnalytics,
  ai: getAIAnalytics,
  response: getResponseAnalytics,
  emergencies: getEmergencyAnalytics,
  locations: getLocationRisk,
  teams: getTeamAnalytics,
  safetyScore: calculateSafetyScore,
  dataQuality: getDataQuality,
  platform: getPlatformAnalytics,
};
