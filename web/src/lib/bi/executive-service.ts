import { connectDB } from "@/lib/db/connect";
import { Organization } from "@/models/Organization";
import {
  getExecutiveOverview,
  getAnalyticsOverview,
  getDataQuality,
  calculateSafetyScore,
  getAIAnalytics,
} from "@/lib/analytics/analytics-service";
import {
  computeKpiPack,
  getIncidentForecast,
  getBenchmarkCampuses,
  detectExecutiveAnomalies,
  getOperationalHealth,
  getConfigurationReadiness,
  periodToFilters,
} from "@/lib/bi/kpi-engine";
import { getOperationsAnalytics } from "@/lib/mobile/field-service";
import { getVideoAnalytics } from "@/lib/video/video-service";
import { getOrCreateSubscription, collectUsage } from "@/lib/platform/billing-service";
import { getAIHealthMetrics } from "@/lib/ai/health-service";
import { analyticsCache } from "@/lib/analytics/cache";

/**
 * Premium executive command center pack — composes Steps 1–16 analytics.
 * Never fabricates KPIs, forecasts, or costs.
 */
export async function getExecutiveCommandCenter(organizationId: string, period: "7D" | "30D" | "90D" = "30D") {
  const cacheKey = analyticsCache.buildKey(organizationId, "execCommand", { period });
  const cached = analyticsCache.get<Awaited<ReturnType<typeof buildExecutiveCommandCenter>>>(cacheKey);
  if (cached) return cached;
  const result = await buildExecutiveCommandCenter(organizationId, period);
  analyticsCache.set(cacheKey, result, 45);
  return result;
}

async function buildExecutiveCommandCenter(organizationId: string, period: "7D" | "30D" | "90D") {
  await connectDB();
  const filters = periodToFilters(period);
  const org = await Organization.findById(organizationId).select("name");

  const [
    executive,
    overview,
    kpis,
    forecast,
    anomalies,
    opHealth,
    readiness,
    dq,
    safety,
  ] = await Promise.all([
    getExecutiveOverview(organizationId, filters),
    getAnalyticsOverview(organizationId, filters),
    computeKpiPack(organizationId, period),
    getIncidentForecast(organizationId),
    detectExecutiveAnomalies(organizationId),
    getOperationalHealth(organizationId),
    getConfigurationReadiness(organizationId),
    getDataQuality(organizationId),
    calculateSafetyScore(organizationId, filters),
  ]);

  const attention: Array<{
    issue: string;
    impact: string;
    severity: string;
    owner: string;
    nextStep: string;
    href: string;
  }> = [];

  for (const k of kpis.belowTarget.slice(0, 5)) {
    attention.push({
      issue: `${k.name} is ${k.status}`,
      impact: k.value != null ? `Current value ${k.value}${k.unit}` : "Insufficient data",
      severity: k.status === "CRITICAL" ? "CRITICAL" : "HIGH",
      owner: "Operations",
      nextStep: "Review source dashboard and assign corrective work",
      href: "/executive/alerts",
    });
  }
  if ((executive.openEmergencies ?? 0) > 0) {
    attention.push({
      issue: "Active emergency",
      impact: `${executive.openEmergencies} open emergency record(s)`,
      severity: "CRITICAL",
      owner: "Emergency Command",
      nextStep: "Open emergency command center",
      href: "/admin/emergency",
    });
  }
  for (const issue of readiness.issues.slice(0, 3)) {
    attention.push({
      issue,
      impact: "Configuration gap may reduce operational coverage",
      severity: "MEDIUM",
      owner: "Admin",
      nextStep: "Resolve in configuration readiness",
      href: "/admin/data-quality",
    });
  }

  const decisionCards = attention.slice(0, 4).map((a) => ({
    issue: a.issue,
    impact: a.impact,
    recommendation: a.nextStep,
    severity: a.severity,
    href: a.href,
  }));

  const statusLabel =
    safety.level === "EXCELLENT" || safety.level === "GOOD"
      ? "GOOD"
      : safety.level === "ATTENTION"
        ? "ATTENTION"
        : safety.level === "CRITICAL" || safety.level === "HIGH_RISK"
          ? "CRITICAL"
          : "ATTENTION";

  return {
    organizationName: (org as { name?: string } | null)?.name ?? "Organization",
    reportingPeriod: period,
    lastUpdated: new Date().toISOString(),
    freshness: "RECENT" as const,
    overallStatus: statusLabel,
    keyChanges: executive.summary?.keyChange ?? "Insufficient data for period comparison.",
    criticalIssues: attention.filter((a) => a.severity === "CRITICAL").length,
    attentionCount: attention.length,
    safetyScore: {
      ...safety,
      disclaimer: safety.disclaimer,
    },
    summary: executive.summary,
    kpis: kpis.kpis,
    metrics: {
      activeIncidents: executive.activeIncidents,
      criticalAlerts: executive.criticalAlerts,
      emergencyStatus: executive.campusMode,
      cameraHealth: executive.cameraAvailability,
      responsePerformance: executive.averageResponseMs,
      resolutionRate: executive.resolutionRate,
      riskTrend: overview.comparison?.incidents?.trend ?? "INSUFFICIENT_DATA",
    },
    topRisks: (executive.topRiskAreas || []).slice(0, 5).map((r: Record<string, unknown>) => ({
      name: r.location,
      events: r.events,
      riskScore: r.riskScore,
      href: `/map?mode=RISK&q=${encodeURIComponent(String(r.location || ""))}`,
    })),
    forecast: {
      ...forecast,
      note: forecast.confidence === "UNAVAILABLE" ? "Forecast unavailable." : "Labeled FORECAST — not fact",
    },
    anomalies: anomalies.anomalies.slice(0, 8),
    attention,
    decisionCards,
    operationalHealth: opHealth,
    configurationReadiness: readiness,
    dataQuality: dq,
    sources: [
      { label: "Incident Analytics", href: "/analytics/incidents" },
      { label: "Camera Analytics", href: "/analytics/cameras" },
      { label: "Response KPI", href: "/analytics/response" },
      { label: "Map Risk", href: "/map?mode=RISK" },
      { label: "Video AI", href: "/analytics/video" },
    ],
    empty: executive.empty,
    message: executive.message,
  };
}

export async function getExecutiveAttention(organizationId: string) {
  const pack = await getExecutiveCommandCenter(organizationId, "30D");
  return { items: pack.attention, decisionCards: pack.decisionCards, lastUpdated: pack.lastUpdated };
}

export async function getBillingIntelligence(organizationId: string) {
  try {
    const sub = await getOrCreateSubscription(organizationId);
    const usage = await collectUsage(organizationId);
    return {
      available: true,
      plan: (sub as { plan?: string }).plan ?? (sub as { tier?: string }).tier ?? "UNKNOWN",
      usage,
      note: "Financial/usage data from existing billing architecture — not fabricated",
    };
  } catch {
    return { available: false, message: "Billing data unavailable", note: "NO DATA" };
  }
}

export async function getSystemHealthScore(organizationId: string) {
  const health = await getAIHealthMetrics(organizationId).catch(() => null);
  const services = (health?.services as Array<{ status: string; name?: string }>) || [];
  const down = services.filter((s) => s.status === "DOWN").length;
  const degraded = services.filter((s) => s.status === "DEGRADED").length;
  const status = down > 0 ? "CRITICAL" : degraded > 0 ? "ATTENTION" : services.length ? "HEALTHY" : "ATTENTION";
  return {
    status,
    services,
    lastUpdated: new Date().toISOString(),
    source: "Existing health / AI health metrics",
  };
}

export async function getVideoAiExecutive(organizationId: string) {
  try {
    const [video, ai] = await Promise.all([
      getVideoAnalytics(organizationId),
      getAIAnalytics(organizationId, periodToFilters("30D")),
    ]);
    return { video, ai, note: "From Steps 12–15 — actual evaluation data only" };
  } catch {
    return { video: null, ai: null, message: "INSUFFICIENT DATA" };
  }
}

export async function buildExecutiveAiBrief(organizationId: string, question: string) {
  const pack = await getExecutiveCommandCenter(organizationId, "30D");
  const q = question.toLowerCase();
  const sections = {
    executiveSummary: pack.keyChanges,
    keyMetrics: pack.kpis.slice(0, 6),
    majorChanges: pack.summary,
    risks: pack.topRisks,
    recommendedActions: pack.decisionCards,
    supportingData: pack.sources,
    label: "AI-GENERATED INSIGHT — based on authorized analytics data",
  };

  let focus = "general";
  if (/risk|building/.test(q)) focus = "risk";
  if (/kpi|below|target/.test(q)) focus = "kpi";
  if (/incident|volume|why/.test(q)) focus = "incidents";
  if (/quarter|month|changed|summarize/.test(q)) focus = "period";
  if (/improv/.test(q)) focus = "improving";

  return {
    question,
    focus,
    ...sections,
    answer:
      focus === "risk"
        ? pack.topRisks.length
          ? `Top operational risk areas: ${pack.topRisks.map((r) => r.name).join(", ")}. Open map for details.`
          : "Insufficient data to identify top risk areas."
        : focus === "kpi"
          ? pack.attention.length
            ? `${pack.attention.length} KPI(s) need attention: ${pack.attention.map((a) => a.issue).join("; ")}`
            : "No KPIs currently below configured thresholds (or insufficient data)."
          : `Organization status ${pack.overallStatus}. ${pack.keyChanges}`,
    empty: pack.empty,
  };
}
