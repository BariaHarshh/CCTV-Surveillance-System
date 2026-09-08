import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { Alert, type IAlert, type IAlertLocation } from "@/models/Alert";
import { Event, type IEvent } from "@/models/Event";
import { User } from "@/models/User";
import { getNextSequence, formatAlertId } from "@/models/Counter";
import { orgFilter } from "@/lib/campus/service";
import type { AlertStatus, SeverityLevel } from "@/lib/monitoring/constants";
import { alertEngine } from "@/lib/monitoring/alert-engine";
import { broadcastAlertCreated, broadcastAlertUpdated } from "@/lib/monitoring/socket-emitter";

export interface CreateAlertFromEventInput {
  event: IEvent;
  location: IAlertLocation;
  source: string;
}

export interface AlertListParams {
  q?: string;
  page?: number;
  limit?: number;
  severity?: string;
  status?: string;
  from?: string;
  to?: string;
}

function toAlertPublic(a: IAlert) {
  return {
    id: a._id.toString(),
    alertId: a.alertId,
    organizationId: a.organizationId.toString(),
    eventId: a.eventId?.toString() ?? null,
    cameraId: a.cameraId?.toString() ?? null,
    location: a.location,
    type: a.type,
    severity: a.severity,
    riskScore: a.riskScore,
    title: a.title,
    description: a.description,
    status: a.status,
    assignedTo: a.assignedTo?.toString() ?? null,
    assignedToName: a.assignedToName,
    acknowledgedBy: a.acknowledgedBy?.toString() ?? null,
    acknowledgedByName: a.acknowledgedByName,
    acknowledgedAt: a.acknowledgedAt?.toISOString() ?? null,
    resolvedBy: a.resolvedBy?.toString() ?? null,
    resolvedByName: a.resolvedByName,
    resolvedAt: a.resolvedAt?.toISOString() ?? null,
    source: a.source,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export async function createAlertFromEvent(input: CreateAlertFromEventInput) {
  await connectDB();
  const { event, location, source } = input;
  const seq = await getNextSequence("alert");
  const title = alertEngine.buildTitle(event.eventType, event.locationLabel);

  const alert = await Alert.create({
    alertId: await formatAlertId(seq),
    organizationId: event.organizationId,
    eventId: event._id,
    cameraId: event.cameraId,
    location,
    type: event.eventType,
    severity: event.severity as SeverityLevel,
    riskScore: event.riskScore,
    title: source === "TEST" ? `[TEST] ${title}` : title,
    description: `Event ${event.eventId} detected at ${event.locationLabel || "unknown location"}.`,
    status: "NEW",
    source,
  });

  const publicAlert = toAlertPublic(alert);
  broadcastAlertCreated(event.organizationId.toString(), publicAlert);
  return publicAlert;
}

export async function listAlerts(organizationId: string, params: AlertListParams = {}) {
  await connectDB();
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(1, params.limit ?? 20));
  const filter: Record<string, unknown> = orgFilter(organizationId);

  if (params.severity && params.severity !== "ALL") filter.severity = params.severity;
  if (params.status && params.status !== "ALL") filter.status = params.status;

  if (params.from || params.to) {
    filter.createdAt = {};
    if (params.from) (filter.createdAt as Record<string, Date>).$gte = new Date(params.from);
    if (params.to) (filter.createdAt as Record<string, Date>).$lte = new Date(params.to);
  }

  if (params.q?.trim()) {
    const q = params.q.trim();
    filter.$or = [
      { alertId: { $regex: q, $options: "i" } },
      { title: { $regex: q, $options: "i" } },
      { type: { $regex: q, $options: "i" } },
      { "location.camera": { $regex: q, $options: "i" } },
    ];
  }

  const [alerts, total] = await Promise.all([
    Alert.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Alert.countDocuments(filter),
  ]);

  return {
    alerts: alerts.map(toAlertPublic),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function getAlertById(organizationId: string, id: string) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const alert = await Alert.findOne(orgFilter(organizationId, { _id: id }));
  if (!alert) return null;

  let event = null;
  if (alert.eventId) {
    const e = await Event.findById(alert.eventId);
    if (e) {
      event = {
        id: e._id.toString(),
        eventId: e.eventId,
        eventType: e.eventType,
        confidence: e.confidence,
        detectedAt: e.detectedAt.toISOString(),
        severity: e.severity,
        riskScore: e.riskScore,
      };
    }
  }

  return { alert: toAlertPublic(alert), event };
}

export async function updateAlertStatus(
  organizationId: string,
  id: string,
  status: AlertStatus,
  actor: { id: string; name: string }
) {
  await connectDB();
  const alert = await Alert.findOne(orgFilter(organizationId, { _id: id }));
  if (!alert) return null;

  alert.status = status;
  if (status === "ACKNOWLEDGED") {
    alert.acknowledgedBy = new mongoose.Types.ObjectId(actor.id);
    alert.acknowledgedByName = actor.name;
    alert.acknowledgedAt = new Date();
  }
  if (status === "INVESTIGATING") {
    alert.acknowledgedBy = alert.acknowledgedBy ?? new mongoose.Types.ObjectId(actor.id);
    alert.acknowledgedByName = alert.acknowledgedByName || actor.name;
    alert.acknowledgedAt = alert.acknowledgedAt ?? new Date();
  }
  if (status === "RESOLVED") {
    alert.resolvedBy = new mongoose.Types.ObjectId(actor.id);
    alert.resolvedByName = actor.name;
    alert.resolvedAt = new Date();
  }
  if (status === "DISMISSED") {
    alert.dismissedBy = new mongoose.Types.ObjectId(actor.id);
    alert.dismissedAt = new Date();
  }

  await alert.save();
  const publicAlert = toAlertPublic(alert);
  broadcastAlertUpdated(organizationId, publicAlert);
  return publicAlert;
}

export async function assignAlert(organizationId: string, id: string, assigneeId: string) {
  await connectDB();
  const alert = await Alert.findOne(orgFilter(organizationId, { _id: id }));
  if (!alert) return null;

  const user = await User.findOne({
    _id: assigneeId,
    organizationId: new mongoose.Types.ObjectId(organizationId),
    role: { $in: ["ADMIN", "STAFF"] },
  });
  if (!user) throw new Error("Assignee not found in organization.");

  alert.assignedTo = user._id;
  alert.assignedToName = `${user.name} (${user.userId})`;
  await alert.save();

  const publicAlert = toAlertPublic(alert);
  broadcastAlertUpdated(organizationId, publicAlert);
  return publicAlert;
}

export async function getAlertStatistics(organizationId: string) {
  await connectDB();
  const base = orgFilter(organizationId);
  const [total, critical, high, medium, low, unresolved, newCount] = await Promise.all([
    Alert.countDocuments(base),
    Alert.countDocuments(orgFilter(organizationId, { severity: "CRITICAL", status: { $nin: ["RESOLVED", "DISMISSED"] } })),
    Alert.countDocuments(orgFilter(organizationId, { severity: "HIGH", status: { $nin: ["RESOLVED", "DISMISSED"] } })),
    Alert.countDocuments(orgFilter(organizationId, { severity: "MEDIUM", status: { $nin: ["RESOLVED", "DISMISSED"] } })),
    Alert.countDocuments(orgFilter(organizationId, { severity: "LOW", status: { $nin: ["RESOLVED", "DISMISSED"] } })),
    Alert.countDocuments(orgFilter(organizationId, { status: { $nin: ["RESOLVED", "DISMISSED"] } })),
    Alert.countDocuments(orgFilter(organizationId, { status: "NEW" })),
  ]);

  return { total, critical, high, medium, low, unresolved, new: newCount };
}

export { toAlertPublic };
