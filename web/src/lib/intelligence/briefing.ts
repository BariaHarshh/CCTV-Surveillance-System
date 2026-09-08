import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { Camera } from "@/models/Camera";
import { Alert } from "@/models/Alert";
import { Incident } from "@/models/Incident";
import { orgFilter } from "@/lib/campus/service";
import type { ConfidenceLevel } from "./constants";

export async function buildPredictiveRisk(organizationId: string) {
  await connectDB();
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const since14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [inc7, incPrev, alert7, offline] = await Promise.all([
    Incident.countDocuments(orgFilter(organizationId, { createdAt: { $gte: since7 } })),
    Incident.countDocuments(orgFilter(organizationId, { createdAt: { $gte: since14, $lt: since7 } })),
    Alert.countDocuments(orgFilter(organizationId, { createdAt: { $gte: since7 }, severity: { $in: ["CRITICAL", "HIGH"] } })),
    Camera.countDocuments(orgFilter(organizationId, { status: { $in: ["OFFLINE", "ERROR", "DISCONNECTED"] } })),
  ]);

  const trend = inc7 - incPrev;
  let currentRisk = Math.min(100, Math.round(inc7 * 8 + alert7 * 5 + offline * 7));
  const factors: string[] = [];
  if (inc7 > 0) factors.push(`${inc7} incidents in the last 7 days`);
  if (trend > 0) factors.push(`Incident volume up ${trend} vs prior week`);
  if (alert7 > 0) factors.push(`${alert7} high/critical alerts this week`);
  if (offline > 0) factors.push(`${offline} cameras offline/error`);

  let confidence: ConfidenceLevel = "MEDIUM";
  if (inc7 + alert7 < 3) confidence = "LOW";
  if (inc7 + alert7 >= 10) confidence = "HIGH";

  return {
    currentRisk,
    trend: trend > 0 ? "INCREASING" : trend < 0 ? "DECREASING" : "STABLE",
    potentialFactors: factors,
    confidence,
    disclaimer:
      "Risk is estimated to be elevated or reduced based on historical patterns. This is not a guarantee that an incident will occur.",
    asOf: new Date().toISOString(),
  };
}

export async function buildCameraMaintenance(organizationId: string) {
  await connectDB();
  const cameras = await Camera.find(orgFilter(organizationId)).limit(200).lean();
  return cameras.map((c) => {
    const status = String((c as { status?: string }).status ?? "UNKNOWN").toUpperCase();
    let health: "Healthy" | "Attention Needed" | "Maintenance Recommended" = "Healthy";
    let reason = "No recent failure signals in available status fields.";
    if (["OFFLINE", "DISCONNECTED", "ERROR"].includes(status)) {
      health = "Maintenance Recommended";
      reason = `Current status is ${status}.`;
    } else if (status === "DEGRADED" || status === "WARNING") {
      health = "Attention Needed";
      reason = `Camera reports ${status} status.`;
    }
    return {
      id: c._id.toString(),
      name: c.name,
      cameraId: (c as { cameraId?: string }).cameraId ?? null,
      health,
      reason,
      status,
    };
  });
}

export async function buildRecommendations(organizationId: string) {
  await connectDB();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [offline, openIncidents, criticalAlerts] = await Promise.all([
    Camera.countDocuments(orgFilter(organizationId, { status: { $in: ["OFFLINE", "ERROR", "DISCONNECTED"] } })),
    Incident.countDocuments(orgFilter(organizationId, { status: { $nin: ["RESOLVED", "CLOSED"] } })),
    Alert.countDocuments(orgFilter(organizationId, { severity: "CRITICAL", createdAt: { $gte: since } })),
  ]);

  const recs: Array<{
    priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    reason: string;
    evidence: string;
    suggestedAction: string;
  }> = [];

  if (offline > 0) {
    recs.push({
      priority: offline >= 3 ? "HIGH" : "MEDIUM",
      reason: "Camera coverage gaps may reduce detection reliability.",
      evidence: `${offline} cameras currently offline/error.`,
      suggestedAction: "Review offline cameras and restore coverage before peak hours.",
    });
  }
  if (openIncidents > 0) {
    recs.push({
      priority: openIncidents >= 5 ? "HIGH" : "MEDIUM",
      reason: "Unresolved incidents accumulate operational risk.",
      evidence: `${openIncidents} open incidents.`,
      suggestedAction: "Triage oldest open incidents and assign owners.",
    });
  }
  if (criticalAlerts > 10) {
    recs.push({
      priority: "MEDIUM",
      reason: "Elevated critical alert volume may indicate alert fatigue risk.",
      evidence: `${criticalAlerts} critical alerts in 30 days.`,
      suggestedAction: "Review alert rules for duplicates — do not disable critical safety alerts automatically.",
    });
  }
  if (recs.length === 0) {
    recs.push({
      priority: "LOW",
      reason: "No elevated operational signals detected from available metrics.",
      evidence: "Open incidents and offline cameras within quiet ranges.",
      suggestedAction: "Continue routine monitoring.",
    });
  }
  return { recommendations: recs, asOf: new Date().toISOString() };
}

export async function buildDailyBriefing(organizationId: string) {
  await connectDB();
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const [criticalAlerts, openIncidents, offlineCameras, risk] = await Promise.all([
    Alert.countDocuments(orgFilter(organizationId, { severity: "CRITICAL", createdAt: { $gte: since } })),
    Incident.countDocuments(orgFilter(organizationId, { status: { $nin: ["RESOLVED", "CLOSED"] } })),
    Camera.countDocuments(orgFilter(organizationId, { status: { $in: ["OFFLINE", "ERROR", "DISCONNECTED"] } })),
    buildPredictiveRisk(organizationId),
  ]);

  const safetyScore = Math.max(0, 100 - Math.min(100, openIncidents * 4 + criticalAlerts * 5 + offlineCameras * 3));
  const oldest = await Incident.findOne(orgFilter(organizationId, { status: { $nin: ["RESOLVED", "CLOSED"] } }))
    .sort({ createdAt: 1 })
    .lean();

  return {
    greeting: "Campus Safety Briefing",
    overallSafety: safetyScore,
    criticalAlerts,
    openIncidents,
    offlineCameras,
    highestRiskNote: risk.potentialFactors[0] ?? "No dominant risk factor identified from current data.",
    riskTrend: risk.trend,
    recommendedAttention: oldest
      ? `Review delayed/open incident ${(oldest as { incidentId?: string }).incidentId ?? oldest._id.toString()}.`
      : "No outstanding incident review required from current open set.",
    confidence: risk.confidence,
    asOf: new Date().toISOString(),
    disclaimer: "All figures are generated from current organization-scoped system data.",
  };
}

export async function buildExecutiveSummary(organizationId: string, range: "today" | "week" | "month") {
  await connectDB();
  const { Emergency } = await import("@/models/Emergency");
  const days = range === "today" ? 1 : range === "week" ? 7 : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [incidents, alerts, emergencies, offline, risk, recs] = await Promise.all([
    Incident.countDocuments(orgFilter(organizationId, { createdAt: { $gte: since } })),
    Alert.countDocuments(orgFilter(organizationId, { createdAt: { $gte: since }, severity: "CRITICAL" })),
    Emergency.countDocuments(orgFilter(organizationId, { createdAt: { $gte: since } })),
    Camera.countDocuments(orgFilter(organizationId, { status: { $in: ["OFFLINE", "ERROR", "DISCONNECTED"] } })),
    buildPredictiveRisk(organizationId),
    buildRecommendations(organizationId),
  ]);

  return {
    range,
    safetyScore: Math.max(0, 100 - Math.min(100, incidents * 3 + alerts * 4 + offline * 3)),
    criticalIncidents: incidents,
    emergencyEvents: emergencies,
    cameraHealthOffline: offline,
    riskTrend: risk.trend,
    recommendedActions: recs.recommendations.slice(0, 3),
    asOf: new Date().toISOString(),
  };
}

export async function summarizeIncident(organizationId: string, incidentId: string) {
  await connectDB();
  if (!mongoose.isValidObjectId(incidentId)) throw new Error("Incident not found");
  const incident = await Incident.findOne(orgFilter(organizationId, { _id: incidentId })).lean();
  if (!incident) throw new Error("Incident not found");

  const timeline: Array<{ at: string; label: string }> = [];
  if (incident.createdAt) timeline.push({ at: incident.createdAt.toISOString(), label: "Incident created" });
  const updated = (incident as { updatedAt?: Date }).updatedAt;
  if (updated) timeline.push({ at: updated.toISOString(), label: "Last updated" });
  const status = (incident as { status?: string }).status;
  if (status === "RESOLVED" || status === "CLOSED") {
    timeline.push({ at: updated?.toISOString() ?? new Date().toISOString(), label: `Incident ${status.toLowerCase()}` });
  }

  return {
    title: (incident as { title?: string }).title ?? (incident as { incidentId?: string }).incidentId,
    status,
    severity: (incident as { severity?: string }).severity ?? null,
    description: (incident as { description?: string }).description ?? null,
    timeline,
    confirmedFacts: [
      `Status: ${status ?? "UNKNOWN"}`,
      `Severity: ${(incident as { severity?: string }).severity ?? "UNKNOWN"}`,
    ],
    potentialFactors: [] as string[],
    note: "Only fields present on the incident record are included. Missing details are not invented.",
    href: `/admin/incidents/${incident._id}`,
  };
}
