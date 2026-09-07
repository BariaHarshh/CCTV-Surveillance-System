import crypto from "crypto";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { Event, type IEvent } from "@/models/Event";
import { Camera } from "@/models/Camera";
import { Building } from "@/models/Building";
import { Room } from "@/models/Room";
import { getNextSequence, formatEventId } from "@/models/Counter";
import { orgFilter } from "@/lib/campus/service";
import type { EventType, EventSource, SeverityLevel } from "@/lib/monitoring/constants";
import { severityEngine } from "@/lib/monitoring/severity-engine";
import { riskService } from "@/lib/monitoring/risk-service";
import { alertEngine } from "@/lib/monitoring/alert-engine";
import { createAlertFromEvent } from "@/lib/monitoring/alert-service";
import { createNotificationForAlert } from "@/lib/monitoring/notification-service";
import { broadcastEventCreated } from "@/lib/monitoring/socket-emitter";

export interface CreateEventInput {
  organizationId: string;
  cameraId?: string | null;
  eventType: EventType;
  confidence?: number | null;
  source?: EventSource;
  detectedAt?: Date;
  metadata?: Record<string, unknown>;
  afterHours?: boolean;
  locationSensitive?: boolean;
}

export interface EventListParams {
  q?: string;
  page?: number;
  limit?: number;
  severity?: string;
  status?: string;
  eventType?: string;
  cameraId?: string;
  buildingId?: string;
  from?: string;
  to?: string;
}

function toEventPublic(e: IEvent, extra?: { cameraName?: string; alertId?: string }) {
  return {
    id: e._id.toString(),
    eventId: e.eventId,
    organizationId: e.organizationId.toString(),
    campusId: e.campusId?.toString() ?? null,
    buildingId: e.buildingId?.toString() ?? null,
    roomId: e.roomId?.toString() ?? null,
    cameraId: e.cameraId?.toString() ?? null,
    eventType: e.eventType,
    severity: e.severity,
    confidence: e.confidence,
    source: e.source,
    detectedAt: e.detectedAt.toISOString(),
    status: e.status,
    riskScore: e.riskScore,
    riskLevel: e.riskLevel,
    riskFactors: e.riskFactors,
    locationLabel: e.locationLabel,
    metadata: e.metadata,
    hasSnapshot: Boolean(e.snapshot?.storageKey),
    cameraName: extra?.cameraName,
    relatedAlertId: extra?.alertId,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

async function resolveLocation(cameraId: string | null | undefined, organizationId: string) {
  if (!cameraId || !mongoose.Types.ObjectId.isValid(cameraId)) {
    return { campusId: null, buildingId: null, roomId: null, label: "", cameraName: "", cameraPublicId: "" };
  }
  const camera = await Camera.findOne(orgFilter(organizationId, { _id: cameraId }));
  if (!camera) return { campusId: null, buildingId: null, roomId: null, label: "", cameraName: "", cameraPublicId: "" };

  const [building, room] = await Promise.all([
    camera.buildingId ? Building.findById(camera.buildingId).select("name") : null,
    camera.roomId ? Room.findById(camera.roomId).select("name roomNumber") : null,
  ]);

  const parts = [building?.name, room ? `${room.roomNumber} — ${room.name}` : camera.areaLabel].filter(Boolean);
  return {
    campusId: camera.campusId,
    buildingId: camera.buildingId,
    roomId: camera.roomId,
    label: parts.join(" · ") || camera.name,
    cameraName: camera.name,
    cameraPublicId: camera.cameraId,
  };
}

export async function createEvent(input: CreateEventInput) {
  await connectDB();

  const loc = await resolveLocation(input.cameraId, input.organizationId);
  const detectedAt = input.detectedAt ?? new Date();
  const confidence = input.confidence ?? null;

  const severity = severityEngine.calculate({
    eventType: input.eventType,
    confidence,
    detectedAt,
    afterHours: input.afterHours,
    locationSensitive: input.locationSensitive,
  });

  const risk = riskService.calculate({
    eventType: input.eventType,
    severity,
    confidence,
    afterHours: input.afterHours,
  });

  const seq = await getNextSequence("event");
  const event = await Event.create({
    eventId: await formatEventId(seq),
    organizationId: new mongoose.Types.ObjectId(input.organizationId),
    campusId: loc.campusId,
    buildingId: loc.buildingId,
    roomId: loc.roomId,
    cameraId: input.cameraId ? new mongoose.Types.ObjectId(input.cameraId) : null,
    eventType: input.eventType,
    severity,
    confidence,
    source: input.source ?? "DETECTION",
    detectedAt,
    status: "OPEN",
    riskScore: risk.riskScore,
    riskLevel: risk.riskLevel,
    riskFactors: risk.riskFactors,
    metadata: input.metadata ?? {},
    locationLabel: loc.label,
  });

  const publicEvent = toEventPublic(event, { cameraName: loc.cameraName });

  broadcastEventCreated(input.organizationId, publicEvent);

  let alert = null;
  if (
    alertEngine.shouldCreateAlert({
      eventType: input.eventType,
      severity,
      riskScore: risk.riskScore,
      source: input.source ?? "DETECTION",
    })
  ) {
    alert = await createAlertFromEvent({
      event,
      location: {
        campus: "",
        building: loc.label.split(" · ")[0],
        room: loc.label.split(" · ")[1],
        camera: loc.cameraName,
        cameraPublicId: loc.cameraPublicId,
      },
      source: input.source ?? "DETECTION",
    });
    if (alert && (severity === "CRITICAL" || severity === "HIGH")) {
      await createNotificationForAlert(input.organizationId, alert, null);
    }
  }

  return { event: publicEvent, alert };
}

export async function listEvents(organizationId: string, params: EventListParams = {}) {
  await connectDB();
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(1, params.limit ?? 20));
  const filter: Record<string, unknown> = orgFilter(organizationId);

  if (params.severity && params.severity !== "ALL") filter.severity = params.severity;
  if (params.status && params.status !== "ALL") filter.status = params.status;
  if (params.eventType && params.eventType !== "ALL") filter.eventType = params.eventType;
  if (params.cameraId) filter.cameraId = new mongoose.Types.ObjectId(params.cameraId);
  if (params.buildingId) filter.buildingId = new mongoose.Types.ObjectId(params.buildingId);

  if (params.from || params.to) {
    filter.detectedAt = {};
    if (params.from) (filter.detectedAt as Record<string, Date>).$gte = new Date(params.from);
    if (params.to) (filter.detectedAt as Record<string, Date>).$lte = new Date(params.to);
  }

  if (params.q?.trim()) {
    const q = params.q.trim();
    filter.$or = [
      { eventId: { $regex: q, $options: "i" } },
      { eventType: { $regex: q, $options: "i" } },
      { locationLabel: { $regex: q, $options: "i" } },
    ];
  }

  const [events, total] = await Promise.all([
    Event.find(filter).sort({ detectedAt: -1 }).skip((page - 1) * limit).limit(limit),
    Event.countDocuments(filter),
  ]);

  return {
    events: events.map((e) => toEventPublic(e)),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function getEventById(organizationId: string, id: string) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const event = await Event.findOne(orgFilter(organizationId, { _id: id }));
  if (!event) return null;

  let cameraName = "";
  if (event.cameraId) {
    const cam = await Camera.findById(event.cameraId).select("name");
    cameraName = cam?.name ?? "";
  }

  return toEventPublic(event, { cameraName });
}

export async function getEventSnapshot(organizationId: string, id: string) {
  await connectDB();
  const event = await Event.findOne(orgFilter(organizationId, { _id: id }));
  if (!event?.snapshot?.storageKey) return null;
  return event.snapshot;
}

export async function storeEventSnapshot(organizationId: string, eventId: string, buffer: Buffer, contentType = "image/jpeg") {
  await connectDB();
  const event = await Event.findOne(orgFilter(organizationId, { _id: eventId }));
  if (!event) return null;
  const key = `snapshots/${organizationId}/${event.eventId}-${crypto.randomBytes(8).toString("hex")}.jpg`;
  event.snapshot = { storageKey: key, contentType, capturedAt: new Date() };
  await event.save();
  return { storageKey: key, buffer };
}

export async function getEventStatistics(organizationId: string) {
  await connectDB();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [total, todayCount, active, critical] = await Promise.all([
    Event.countDocuments(orgFilter(organizationId)),
    Event.countDocuments(orgFilter(organizationId, { detectedAt: { $gte: today } })),
    Event.countDocuments(orgFilter(organizationId, { status: { $in: ["OPEN", "ACKNOWLEDGED"] } })),
    Event.countDocuments(orgFilter(organizationId, { severity: "CRITICAL", status: { $ne: "RESOLVED" } })),
  ]);

  return { total, today: todayCount, active, critical };
}

export { toEventPublic };
