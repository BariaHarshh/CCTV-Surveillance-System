import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { Event } from "@/models/Event";
import { SafetyPattern } from "@/models/SafetyPattern";
import { getNextSequence, formatPatternId } from "@/models/Counter";
import { orgFilter } from "@/lib/campus/service";
import type { AnalyticsFilters } from "@/lib/analytics/filters";
import { dateRange, orgId } from "@/lib/analytics/filters";
import { MIN_SAMPLES_FOR_TREND, type PatternType } from "@/lib/analytics/constants";

function confidenceLabel(freq: number): { confidence: number; label: string } {
  if (freq >= 10) return { confidence: 0.9, label: "High" };
  if (freq >= 5) return { confidence: 0.7, label: "Medium" };
  if (freq >= MIN_SAMPLES_FOR_TREND) return { confidence: 0.5, label: "Low" };
  return { confidence: 0.3, label: "Low" };
}

/** Detect recurring patterns from historical events — not crime prediction. */
export async function detectPatterns(organizationId: string, filters: AnalyticsFilters = {}) {
  await connectDB();
  const { from, to } = dateRange(filters);
  const match: Record<string, unknown> = {
    organizationId: orgId(organizationId),
    detectedAt: { $gte: from, $lte: to },
  };
  if (!filters.includeTest) match.source = { $ne: "TEST" };

  const clusters = await Event.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          eventType: "$eventType",
          building: { $ifNull: ["$locationLabel", "Unknown"] },
          hour: { $hour: "$detectedAt" },
        },
        count: { $sum: 1 },
        first: { $min: "$detectedAt" },
        last: { $max: "$detectedAt" },
        eventIds: { $push: "$_id" },
        severities: { $push: "$severity" },
      },
    },
    { $match: { count: { $gte: MIN_SAMPLES_FOR_TREND } } },
    { $sort: { count: -1 } },
    { $limit: 25 },
  ]);

  const patterns = [];
  for (const c of clusters) {
    const conf = confidenceLabel(c.count);
    const isAfterHours = c._id.hour >= 21 || c._id.hour < 6;
    const type: PatternType =
      c._id.eventType === "AFTER_HOURS_ACTIVITY" || isAfterHours
        ? "AFTER_HOURS_PATTERN"
        : c.count >= 5
          ? "REPEATED_INCIDENT_PATTERN"
          : "LOCATION_PATTERN";

    patterns.push({
      type,
      description:
        type === "AFTER_HOURS_PATTERN"
          ? `Repeated after-hours activity detected — ${c._id.building}`
          : `Repeated ${String(c._id.eventType).replace(/_/g, " ").toLowerCase()} — ${c._id.building}`,
      locations: [c._id.building],
      eventTypes: [c._id.eventType],
      frequency: c.count,
      severity: c.severities.includes("CRITICAL") ? "CRITICAL" : c.severities.includes("HIGH") ? "HIGH" : "MEDIUM",
      confidence: conf.confidence,
      confidenceLabel: conf.label,
      firstObserved: c.first,
      lastObserved: c.last,
      relatedEventIds: c.eventIds.slice(0, 50),
      metadata: {
        hour: c._id.hour,
        timeRange:
          c._id.hour != null ? `${String(c._id.hour).padStart(2, "0")}:00–${String((c._id.hour + 2) % 24).padStart(2, "0")}:00` : null,
        disclaimer: "Pattern confidence refers to the detection calculation, not a prediction of future incidents.",
      },
    });
  }

  return {
    empty: patterns.length === 0,
    message: patterns.length === 0 ? "No recurring patterns detected for this period." : undefined,
    patterns,
    disclaimer: "Patterns describe historical recurrence only. This is not crime prediction.",
  };
}

export async function persistDetectedPatterns(organizationId: string, filters: AnalyticsFilters = {}) {
  const detected = await detectPatterns(organizationId, filters);
  const saved = [];
  for (const p of detected.patterns) {
    const existing = await SafetyPattern.findOne({
      ...orgFilter(organizationId),
      type: p.type,
      description: p.description,
      status: "ACTIVE",
    });
    if (existing) {
      existing.frequency = p.frequency;
      existing.lastObserved = p.lastObserved;
      existing.confidence = p.confidence;
      existing.confidenceLabel = p.confidenceLabel;
      await existing.save();
      saved.push(existing);
      continue;
    }
    const seq = await getNextSequence("pattern");
    const doc = await SafetyPattern.create({
      patternId: await formatPatternId(seq),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      ...p,
      status: "ACTIVE",
      source: "SYSTEM",
    });
    saved.push(doc);
  }
  return saved.map((p) => ({
    id: p._id.toString(),
    patternId: p.patternId,
    type: p.type,
    description: p.description,
    locations: p.locations,
    eventTypes: p.eventTypes,
    frequency: p.frequency,
    severity: p.severity,
    confidence: p.confidence,
    confidenceLabel: p.confidenceLabel,
    firstObserved: p.firstObserved.toISOString(),
    lastObserved: p.lastObserved.toISOString(),
    status: p.status,
    metadata: p.metadata,
  }));
}

export async function listPatterns(organizationId: string) {
  await connectDB();
  const items = await SafetyPattern.find(orgFilter(organizationId, { status: { $ne: "DISMISSED" } }))
    .sort({ frequency: -1 })
    .limit(50);
  return items.map((p) => ({
    id: p._id.toString(),
    patternId: p.patternId,
    type: p.type,
    description: p.description,
    locations: p.locations,
    eventTypes: p.eventTypes,
    frequency: p.frequency,
    severity: p.severity,
    confidence: p.confidence,
    confidenceLabel: p.confidenceLabel,
    firstObserved: p.firstObserved.toISOString(),
    lastObserved: p.lastObserved.toISOString(),
    status: p.status,
    metadata: p.metadata,
    relatedEventIds: p.relatedEventIds.map((id) => id.toString()),
  }));
}
