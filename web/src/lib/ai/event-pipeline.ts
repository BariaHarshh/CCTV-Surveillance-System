import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { Event, type IEvent } from "@/models/Event";
import { Camera } from "@/models/Camera";
import { Building } from "@/models/Building";
import { Room } from "@/models/Room";
import { getNextSequence, formatEventId } from "@/models/Counter";
import { orgFilter } from "@/lib/campus/service";
import type { EventSource, EventType, SeverityLevel } from "@/lib/monitoring/constants";
import { alertEngine } from "@/lib/monitoring/alert-engine";
import { createAlertFromEvent } from "@/lib/monitoring/alert-service";
import { createNotificationForAlert } from "@/lib/monitoring/notification-service";
import { broadcastEventCreated } from "@/lib/monitoring/socket-emitter";
import { createOrUpdateIncident } from "@/lib/ai/incident-service";
import type { RiskEngineResult } from "@/lib/ai/risk-engine";

export interface CreateEventRecordInput {
  organizationId: string;
  cameraId: string;
  eventType: EventType;
  confidence?: number | null;
  source?: EventSource;
  detectedAt?: Date;
  metadata?: Record<string, unknown>;
  afterHours?: boolean;
  locationSensitive?: boolean;
  severity: SeverityLevel;
  risk: RiskEngineResult;
  relatedEventCount?: number;
}

function toEventPublic(e: IEvent, extra?: { cameraName?: string }) {
  return {
    id: e._id.toString(),
    eventId: e.eventId,
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
    cameraName: extra?.cameraName,
  };
}

async function resolveLocation(cameraId: string, organizationId: string) {
  const isMongoId = mongoose.Types.ObjectId.isValid(cameraId);
  const query = isMongoId ? { $or: [{ _id: cameraId }, { cameraId }] } : { cameraId };
  const camera = await Camera.findOne(orgFilter(organizationId, query));
  if (!camera) return { cameraDoc: null, campusId: null, buildingId: null, roomId: null, label: "", cameraName: "", cameraPublicId: "" };

  const [building, room] = await Promise.all([
    camera.buildingId ? Building.findById(camera.buildingId).select("name") : null,
    camera.roomId ? Room.findById(camera.roomId).select("name roomNumber") : null,
  ]);

  const parts = [building?.name, room ? `${room.roomNumber} — ${room.name}` : camera.areaLabel].filter(Boolean);
  return {
    cameraDoc: camera,
    campusId: camera.campusId,
    buildingId: camera.buildingId,
    roomId: camera.roomId,
    label: parts.join(" · ") || camera.name,
    cameraName: camera.name,
    cameraPublicId: camera.cameraId,
  };
}

export async function createEventRecord(input: CreateEventRecordInput) {
  await connectDB();
  const loc = await resolveLocation(input.cameraId, input.organizationId);
  const detectedAt = input.detectedAt ?? new Date();

  const targetCameraId = loc.cameraDoc ? loc.cameraDoc._id : (mongoose.Types.ObjectId.isValid(input.cameraId) ? new mongoose.Types.ObjectId(input.cameraId) : new mongoose.Types.ObjectId());

  const seq = await getNextSequence("event");
  const event = await Event.create({
    eventId: await formatEventId(seq),
    organizationId: new mongoose.Types.ObjectId(input.organizationId),
    campusId: loc.campusId,
    buildingId: loc.buildingId,
    roomId: loc.roomId,
    cameraId: targetCameraId,
    eventType: input.eventType,
    severity: input.severity,
    confidence: input.confidence ?? null,
    source: input.source ?? "DETECTION",
    detectedAt,
    status: "OPEN",
    riskScore: input.risk.riskScore,
    riskLevel: input.risk.riskLevel,
    riskFactors: input.risk.riskFactors,
    metadata: input.metadata ?? {},
    locationLabel: loc.label,
  });

  const publicEvent = toEventPublic(event, { cameraName: loc.cameraName });
  broadcastEventCreated(input.organizationId, publicEvent);

  let alert = null;
  let incident = null;

  if (
    alertEngine.shouldCreateAlert({
      eventType: input.eventType,
      severity: input.severity,
      riskScore: input.risk.riskScore,
      source: input.source ?? "DETECTION",
    })
  ) {
    alert = await createAlertFromEvent({
      event,
      location: {
        building: loc.label.split(" · ")[0],
        room: loc.label.split(" · ")[1],
        camera: loc.cameraName,
        cameraPublicId: loc.cameraPublicId,
      },
      source: input.source ?? "DETECTION",
    });
    if (alert && (input.severity === "CRITICAL" || input.severity === "HIGH")) {
      await createNotificationForAlert(input.organizationId, alert, null);
    }
  }

  if (input.severity === "HIGH" || input.severity === "CRITICAL" || (input.relatedEventCount ?? 0) >= 1) {
    incident = await createOrUpdateIncident({
      organizationId: input.organizationId,
      eventId: event._id.toString(),
      alertId: alert?.id ?? null,
      title: `${input.eventType.replace(/_/g, " ")} — ${loc.label}`,
      severity: input.severity,
      riskScore: input.risk.riskScore,
      location: { building: loc.label.split(" · ")[0], room: loc.label.split(" · ")[1], camera: loc.cameraName, label: loc.label },
      source: input.source ?? "DETECTION",
    });
  }

  return { event: publicEvent, alert, incident };
}
