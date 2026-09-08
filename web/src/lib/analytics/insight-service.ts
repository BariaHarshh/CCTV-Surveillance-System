import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { SafetyInsight } from "@/models/AnalyticsReport";
import { getNextSequence, formatInsightId } from "@/models/Counter";
import { orgFilter } from "@/lib/campus/service";
import type { AnalyticsFilters } from "@/lib/analytics/filters";
import { getAnalyticsOverview, getLocationRisk, getCameraAnalytics } from "@/lib/analytics/analytics-service";
import type { InsightFeedback } from "@/lib/analytics/constants";

/**
 * Insights are generated only from verified calculated metrics.
 * Never invent statistics. Recommendations are "Suggested Review" only.
 */
export async function generateInsights(organizationId: string, filters: AnalyticsFilters = {}) {
  await connectDB();
  const [overview, locations, cameras] = await Promise.all([
    getAnalyticsOverview(organizationId, filters),
    getLocationRisk(organizationId, filters),
    getCameraAnalytics(organizationId, filters),
  ]);

  const insights: Array<{
    title: string;
    evidence: string[];
    change: string | null;
    affectedArea: string | null;
    suggestedReview: string | null;
    metrics: Record<string, unknown>;
  }> = [];

  if (overview.comparison.incidents.changePercent != null) {
    const ch = overview.comparison.incidents.changePercent;
    insights.push({
      title: ch >= 0 ? "Incident volume increased" : "Incident volume decreased",
      evidence: [
        `${overview.comparison.incidents.current} incidents this period`,
        `${overview.comparison.incidents.previous} incidents previous period`,
      ],
      change: `${ch > 0 ? "+" : ""}${ch}%`,
      affectedArea: null,
      suggestedReview: "Review incident distribution by building and event type",
      metrics: overview.comparison.incidents,
    });
  }

  if (locations.buildings?.[0]) {
    const top = locations.buildings[0];
    insights.push({
      title: `${top.location} generated the highest number of incidents`,
      evidence: [`${top.events} incidents`, `${top.critical} critical`, `Avg risk ${top.riskScore}`],
      change: null,
      affectedArea: top.location,
      suggestedReview: "Review camera coverage and access policy for this area",
      metrics: top,
    });
  }

  if (cameras.averageAvailability != null && cameras.averageAvailability < 95) {
    insights.push({
      title: "Camera availability decreased during the selected period",
      evidence: [
        `${cameras.averageAvailability}% cameras online`,
        `${cameras.offline} offline`,
      ],
      change: null,
      affectedArea: null,
      suggestedReview: "Inspect offline cameras and stream health",
      metrics: { averageAvailability: cameras.averageAvailability, offline: cameras.offline },
    });
  }

  if (overview.alerts.acknowledgementRate != null && overview.alerts.acknowledgementRate >= 70) {
    insights.push({
      title: "Alert acknowledgement performance",
      evidence: [`Acknowledgement rate ${overview.alerts.acknowledgementRate}%`],
      change: null,
      affectedArea: null,
      suggestedReview: null,
      metrics: { acknowledgementRate: overview.alerts.acknowledgementRate },
    });
  }

  // Persist fresh insights (replace recent system ones for period)
  const saved = [];
  for (const insight of insights) {
    const seq = await getNextSequence("insight");
    const doc = await SafetyInsight.create({
      insightId: await formatInsightId(seq),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      title: insight.title,
      evidence: insight.evidence,
      change: insight.change,
      affectedArea: insight.affectedArea,
      suggestedReview: insight.suggestedReview,
      metrics: insight.metrics,
      period: `${overview.period.from} → ${overview.period.to}`,
      source: "SYSTEM",
    });
    saved.push(doc);
  }

  return {
    empty: insights.length === 0,
    message: insights.length === 0 ? "No insights available for this period." : undefined,
    insights: saved.map(toPublic),
    note: "Insights are derived from verified platform metrics. Suggested reviews are recommendations, not guaranteed solutions.",
  };
}

function toPublic(i: {
  _id: mongoose.Types.ObjectId;
  insightId: string;
  title: string;
  evidence: string[];
  change: string | null;
  affectedArea: string | null;
  suggestedReview: string | null;
  metrics: Record<string, unknown>;
  period: string;
  feedback: string | null;
  createdAt: Date;
}) {
  return {
    id: i._id.toString(),
    insightId: i.insightId,
    title: i.title,
    evidence: i.evidence,
    change: i.change,
    affectedArea: i.affectedArea,
    suggestedReview: i.suggestedReview,
    metrics: i.metrics,
    period: i.period,
    feedback: i.feedback,
    createdAt: i.createdAt.toISOString(),
  };
}

export async function listInsights(organizationId: string) {
  await connectDB();
  const items = await SafetyInsight.find(orgFilter(organizationId)).sort({ createdAt: -1 }).limit(40);
  return items.map(toPublic);
}

export async function submitInsightFeedback(organizationId: string, id: string, feedback: InsightFeedback) {
  await connectDB();
  const insight = await SafetyInsight.findOne(orgFilter(organizationId, { _id: id }));
  if (!insight) return null;
  insight.feedback = feedback;
  await insight.save();
  return toPublic(insight);
}
