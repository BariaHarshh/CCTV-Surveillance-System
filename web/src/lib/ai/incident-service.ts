import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { Incident, type IIncident } from "@/models/Incident";
import { Event } from "@/models/Event";
import { Alert } from "@/models/Alert";
import { getNextSequence, formatIncidentId } from "@/models/Counter";
import { orgFilter } from "@/lib/campus/service";
import type { IncidentStatus } from "@/lib/ai/constants";
import type { SeverityLevel } from "@/lib/monitoring/constants";
import { emitToOrganization } from "@/lib/monitoring/socket-emitter";
import { SOCKET_EVENTS } from "@/lib/monitoring/constants";

function toPublic(i: IIncident) {
  return {
    id: i._id.toString(),
    incidentId: i.incidentId,
    organizationId: i.organizationId.toString(),
    eventIds: i.eventIds.map((id) => id.toString()),
    alertIds: i.alertIds.map((id) => id.toString()),
    location: i.location,
    severity: i.severity,
    riskScore: i.riskScore,
    status: i.status,
    assignedTo: i.assignedTo?.toString() ?? null,
    assignedToName: i.assignedToName,
    assignedTeam: i.assignedTeam?.toString() ?? null,
    assignedTeamName: i.assignedTeamName ?? "",
    emergencyId: i.emergencyId?.toString() ?? null,
    title: i.title,
    startedAt: i.startedAt.toISOString(),
    resolvedAt: i.resolvedAt?.toISOString() ?? null,
    source: i.source,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  };
}

export interface CreateOrUpdateIncidentInput {
  organizationId: string;
  eventId: string;
  alertId?: string | null;
  title: string;
  severity: SeverityLevel;
  riskScore: number;
  location: IIncident["location"];
  source?: string;
}

export async function createOrUpdateIncident(input: CreateOrUpdateIncidentInput) {
  await connectDB();
  const eventObjectId = new mongoose.Types.ObjectId(input.eventId);
  const windowStart = new Date(Date.now() - 10 * 60 * 1000);

  let incident = await Incident.findOne(
    orgFilter(input.organizationId, {
      status: { $in: ["OPEN", "INVESTIGATING"] },
      startedAt: { $gte: windowStart },
      "location.camera": input.location.camera,
    })
  );

  if (incident) {
    if (!incident.eventIds.some((id) => id.equals(eventObjectId))) {
      incident.eventIds.push(eventObjectId);
    }
    if (input.alertId) {
      const alertOid = new mongoose.Types.ObjectId(input.alertId);
      if (!incident.alertIds.some((id) => id.equals(alertOid))) {
        incident.alertIds.push(alertOid);
      }
    }
    if (input.riskScore > incident.riskScore) incident.riskScore = input.riskScore;
    if (input.severity === "CRITICAL" || (input.severity === "HIGH" && incident.severity !== "CRITICAL")) {
      incident.severity = input.severity;
    }
    await incident.save();
  } else {
    const seq = await getNextSequence("incident");
    incident = await Incident.create({
      incidentId: await formatIncidentId(seq),
      organizationId: new mongoose.Types.ObjectId(input.organizationId),
      eventIds: [eventObjectId],
      alertIds: input.alertId ? [new mongoose.Types.ObjectId(input.alertId)] : [],
      location: input.location,
      severity: input.severity,
      riskScore: input.riskScore,
      status: "OPEN",
      title: input.title,
      source: input.source ?? "DETECTION",
    });
  }

  const publicIncident = toPublic(incident);
  emitToOrganization(input.organizationId, SOCKET_EVENTS.INCIDENT_UPDATED, publicIncident);
  return publicIncident;
}

export async function listIncidents(
  organizationId: string,
  params: { status?: string; q?: string; page?: number; limit?: number } = {}
) {
  await connectDB();
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(1, params.limit ?? 20));
  const filter: Record<string, unknown> = orgFilter(organizationId);

  if (params.status && params.status !== "ALL") filter.status = params.status;
  if (params.q?.trim()) {
    const q = params.q.trim();
    filter.$or = [
      { incidentId: { $regex: q, $options: "i" } },
      { title: { $regex: q, $options: "i" } },
      { "location.label": { $regex: q, $options: "i" } },
    ];
  }

  const [items, total, open, critical] = await Promise.all([
    Incident.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Incident.countDocuments(filter),
    Incident.countDocuments(orgFilter(organizationId, { status: "OPEN" })),
    Incident.countDocuments(orgFilter(organizationId, { severity: "CRITICAL", status: { $nin: ["RESOLVED", "DISMISSED"] } })),
  ]);

  return {
    incidents: items.map(toPublic),
    stats: { open, critical, total },
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  };
}

export async function getIncidentById(organizationId: string, id: string) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const incident = await Incident.findOne(orgFilter(organizationId, { _id: id }));
  if (!incident) return null;

  const [events, alerts] = await Promise.all([
    Event.find({ _id: { $in: incident.eventIds } }).sort({ detectedAt: -1 }),
    Alert.find({ _id: { $in: incident.alertIds } }).sort({ createdAt: -1 }),
  ]);

  return {
    incident: toPublic(incident),
    events: events.map((e) => ({
      id: e._id.toString(),
      eventId: e.eventId,
      eventType: e.eventType,
      severity: e.severity,
      detectedAt: e.detectedAt.toISOString(),
      confidence: e.confidence,
    })),
    alerts: alerts.map((a) => ({
      id: a._id.toString(),
      alertId: a.alertId,
      title: a.title,
      severity: a.severity,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

export async function updateIncidentStatus(
  organizationId: string,
  id: string,
  status: IncidentStatus,
  actor: { id: string; name: string }
) {
  await connectDB();
  const incident = await Incident.findOne(orgFilter(organizationId, { _id: id }));
  if (!incident) return null;

  const transitions: Record<string, string[]> = {
    OPEN: ["INVESTIGATING", "DISMISSED", "RESOLVED", "CONTAINED"],
    INVESTIGATING: ["CONTAINED", "RESOLVED", "DISMISSED", "OPEN"],
    CONTAINED: ["RESOLVED", "INVESTIGATING", "DISMISSED"],
    RESOLVED: [],
    DISMISSED: [],
  };
  const allowed = transitions[incident.status] ?? [];
  if (status !== incident.status && !allowed.includes(status)) {
    return { error: "INVALID_TRANSITION" as const, from: incident.status, to: status };
  }

  incident.status = status;
  if (status === "RESOLVED" || status === "DISMISSED") {
    incident.resolvedAt = new Date();
    incident.resolvedBy = new mongoose.Types.ObjectId(actor.id);
  }
  await incident.save();

  const publicIncident = toPublic(incident);
  emitToOrganization(organizationId, SOCKET_EVENTS.INCIDENT_UPDATED, publicIncident);
  return publicIncident;
}

export async function assignIncident(
  organizationId: string,
  id: string,
  assigneeId: string | null,
  assigneeName: string,
  team?: { teamId: string; teamName: string } | null
) {
  await connectDB();
  const incident = await Incident.findOne(orgFilter(organizationId, { _id: id }));
  if (!incident) return null;

  if (assigneeId) {
    incident.assignedTo = new mongoose.Types.ObjectId(assigneeId);
    incident.assignedToName = assigneeName;
  }
  if (team) {
    incident.assignedTeam = new mongoose.Types.ObjectId(team.teamId);
    incident.assignedTeamName = team.teamName;
  }
  if (incident.status === "OPEN") incident.status = "INVESTIGATING";
  await incident.save();

  const publicIncident = toPublic(incident);
  emitToOrganization(organizationId, SOCKET_EVENTS.INCIDENT_UPDATED, publicIncident);
  emitToOrganization(organizationId, SOCKET_EVENTS.INCIDENT_ASSIGNED, publicIncident);
  return publicIncident;
}
