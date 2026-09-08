import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { DailySafetyMetric, MetricBaseline } from "@/models/DailySafetyMetric";
import { Organization } from "@/models/Organization";
import { Incident } from "@/models/Incident";
import { Alert } from "@/models/Alert";
import { Emergency } from "@/models/Emergency";
import { Event } from "@/models/Event";
import { Camera } from "@/models/Camera";
import { CorrectiveAction } from "@/models/CorrectiveAction";
import { orgFilter } from "@/lib/campus/service";
import { mean, median, stdDev } from "@/lib/analytics/filters";
import { MIN_SAMPLES_FOR_ANOMALY } from "@/lib/analytics/constants";

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Idempotent daily aggregation — safe to run twice. */
export async function aggregateDailyMetrics(organizationId: string, date = new Date()) {
  await connectDB();
  const day = dayKey(date);
  const from = new Date(`${day}T00:00:00.000Z`);
  const to = new Date(`${day}T23:59:59.999Z`);
  const nonTest = { source: { $ne: "TEST" as const } };

  const [incidents, alerts, emergencies, events, cameras, actions] = await Promise.all([
    Incident.countDocuments({ ...orgFilter(organizationId), startedAt: { $gte: from, $lte: to }, ...nonTest }),
    Alert.countDocuments({ ...orgFilter(organizationId), createdAt: { $gte: from, $lte: to }, ...nonTest }),
    Emergency.countDocuments({ ...orgFilter(organizationId), activatedAt: { $gte: from, $lte: to }, ...nonTest }),
    Event.countDocuments({ ...orgFilter(organizationId), detectedAt: { $gte: from, $lte: to }, ...nonTest }),
    Camera.find(orgFilter(organizationId)).select("status").lean(),
    CorrectiveAction.countDocuments({ ...orgFilter(organizationId), createdAt: { $gte: from, $lte: to }, ...nonTest }),
  ]);

  const criticalEvents = await Event.countDocuments({
    ...orgFilter(organizationId),
    detectedAt: { $gte: from, $lte: to },
    severity: "CRITICAL",
    ...nonTest,
  });

  const online = cameras.filter((c) => c.status === "ONLINE").length;
  const cameraAvailability = cameras.length ? Math.round((online / cameras.length) * 1000) / 10 : null;

  const ackAlerts = await Alert.find({
    ...orgFilter(organizationId),
    createdAt: { $gte: from, $lte: to },
    acknowledgedAt: { $ne: null },
    ...nonTest,
  })
    .select("createdAt acknowledgedAt")
    .lean();
  const responseTimes = ackAlerts.map(
    (a) => new Date(a.acknowledgedAt!).getTime() - new Date(a.createdAt).getTime()
  );

  await DailySafetyMetric.findOneAndUpdate(
    {
      organizationId: new mongoose.Types.ObjectId(organizationId),
      date: day,
      campusId: null,
      buildingId: null,
    },
    {
      $set: {
        incidents,
        alerts,
        emergencies,
        criticalEvents,
        events,
        responseTimeMsAvg: mean(responseTimes),
        cameraAvailability,
        aiEvents: events,
        correctiveActions: actions,
        source: "AGGREGATED",
      },
    },
    { upsert: true, new: true }
  );

  return { organizationId, date: day, incidents, alerts, emergencies, events };
}

export async function runAnalyticsAggregationWorker(organizationIds?: string[]) {
  await connectDB();
  const orgs =
    organizationIds ??
    (await Organization.find({ deletedAt: null, status: "ACTIVE" }).select("_id").lean()).map((o) =>
      o._id.toString()
    );

  const results = [];
  for (const orgId of orgs) {
    results.push(await aggregateDailyMetrics(orgId));
    await updateBaselines(orgId);
    try {
      const { emitToOrganization } = await import("@/lib/monitoring/socket-emitter");
      emitToOrganization(orgId, "analytics:updated", { organizationId: orgId, at: new Date().toISOString() });
    } catch {
      /* socket optional during aggregation */
    }
  }
  return results;
}

export async function updateBaselines(organizationId: string) {
  await connectDB();
  const metrics = await DailySafetyMetric.find({
    organizationId: new mongoose.Types.ObjectId(organizationId),
    campusId: null,
  })
    .sort({ date: -1 })
    .limit(30)
    .lean();

  const incidentCounts = metrics.map((m) => m.incidents);
  if (incidentCounts.length < MIN_SAMPLES_FOR_ANOMALY) return null;

  await MetricBaseline.findOneAndUpdate(
    {
      organizationId: new mongoose.Types.ObjectId(organizationId),
      metric: "incidents_daily",
      location: "ORG",
    },
    {
      $set: {
        baselinePeriod: "30d",
        mean: mean(incidentCounts) ?? 0,
        median: median(incidentCounts) ?? 0,
        standardDeviation: stdDev(incidentCounts) ?? 0,
        sampleCount: incidentCounts.length,
      },
    },
    { upsert: true }
  );
  return true;
}

/** Anomaly foundation — unusual vs baseline, not auto-incident. */
export async function detectAnomalies(organizationId: string) {
  await connectDB();
  const baseline = await MetricBaseline.findOne({
    organizationId: new mongoose.Types.ObjectId(organizationId),
    metric: "incidents_daily",
  });
  if (!baseline || baseline.sampleCount < MIN_SAMPLES_FOR_ANOMALY) {
    return {
      empty: true,
      message: "Insufficient historical data for anomaly detection.",
      anomalies: [],
    };
  }

  const today = await DailySafetyMetric.findOne({
    organizationId: new mongoose.Types.ObjectId(organizationId),
    date: dayKey(new Date()),
    campusId: null,
  });

  const anomalies = [];
  if (today && baseline.standardDeviation > 0) {
    const z = (today.incidents - baseline.mean) / baseline.standardDeviation;
    if (Math.abs(z) >= 2) {
      anomalies.push({
        metric: "incidents_daily",
        value: today.incidents,
        baselineMean: baseline.mean,
        zScore: Math.round(z * 100) / 100,
        message:
          today.incidents > baseline.mean
            ? "Incident volume is unusually high compared with the recent baseline."
            : "Incident volume is unusually low compared with the recent baseline.",
        note: "An anomaly is not automatically a security incident.",
      });
    }
  }

  return { empty: anomalies.length === 0, anomalies };
}

export const analyticsAggregationWorker = {
  run: runAnalyticsAggregationWorker,
  aggregateDaily: aggregateDailyMetrics,
  detectAnomalies,
};
