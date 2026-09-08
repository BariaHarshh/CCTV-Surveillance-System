import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { orgFilter } from "@/lib/campus/service";
import { getNextSequence, formatEmergencyId } from "@/models/Counter";
import {
  Emergency,
  OrganizationEmergencyState,
  type IEmergency,
  type IEmergencyLocation,
  type IEmergencyTimelineEntry,
} from "@/models/Emergency";
import { Incident } from "@/models/Incident";
import { Playbook } from "@/models/Playbook";
import {
  EMERGENCY_TRANSITIONS,
  type CampusEmergencyMode,
  type EmergencyStatus,
  type EmergencyType,
} from "@/lib/emergency/constants";
import type { SeverityLevel } from "@/lib/monitoring/constants";
import {
  broadcastEmergencyCreated,
  broadcastEmergencyUpdated,
  broadcastEmergencyResolved,
} from "@/lib/monitoring/socket-emitter";
import { closeEscalationsForEmergency } from "@/lib/emergency/escalation-engine";

function toPublic(e: IEmergency) {
  return {
    id: e._id.toString(),
    emergencyId: e.emergencyId,
    type: e.type,
    severity: e.severity,
    status: e.status,
    mode: e.mode,
    reason: e.reason,
    description: e.description,
    location: e.location,
    affectedBuildingIds: e.affectedBuildingIds.map((id) => id.toString()),
    incidentIds: e.incidentIds.map((id) => id.toString()),
    alertIds: e.alertIds.map((id) => id.toString()),
    teamIds: e.teamIds.map((id) => id.toString()),
    playbookId: e.playbookId?.toString() ?? null,
    timeline: e.timeline.map((t) => ({
      action: t.action,
      description: t.description,
      actorId: t.actorId?.toString() ?? null,
      actorName: t.actorName,
      timestamp: t.timestamp.toISOString(),
      metadata: t.metadata ?? {},
    })),
    activatedBy: e.activatedBy?.toString() ?? null,
    activatedByName: e.activatedByName,
    activatedAt: e.activatedAt.toISOString(),
    resolvedBy: e.resolvedBy?.toString() ?? null,
    resolvedByName: e.resolvedByName,
    resolvedAt: e.resolvedAt?.toISOString() ?? null,
    notes: e.notes,
    source: e.source,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

export async function getOrCreateOrgEmergencyState(organizationId: string) {
  await connectDB();
  let state = await OrganizationEmergencyState.findOne(orgFilter(organizationId));
  if (!state) {
    state = await OrganizationEmergencyState.create({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      mode: "NORMAL",
      activeEmergencyId: null,
    });
  }
  return state;
}

export async function getOrgEmergencyMode(organizationId: string): Promise<CampusEmergencyMode> {
  const state = await getOrCreateOrgEmergencyState(organizationId);
  return state.mode;
}

function pushTimeline(
  emergency: IEmergency,
  entry: Omit<IEmergencyTimelineEntry, "timestamp"> & { timestamp?: Date }
) {
  emergency.timeline.push({
    ...entry,
    timestamp: entry.timestamp ?? new Date(),
    metadata: entry.metadata ?? {},
  });
}

export async function activateEmergency(input: {
  organizationId: string;
  campusId?: string | null;
  type: EmergencyType;
  severity?: SeverityLevel;
  mode?: CampusEmergencyMode;
  reason: string;
  description?: string;
  location?: IEmergencyLocation;
  affectedBuildingIds?: string[];
  incidentId?: string | null;
  playbookId?: string | null;
  teamIds?: string[];
  actor: { id: string; name: string };
  source?: string;
}) {
  await connectDB();
  const seq = await getNextSequence("emergency");
  const emergencyId = await formatEmergencyId(seq);

  let playbookId = input.playbookId ?? null;
  if (!playbookId) {
    const pb = await Playbook.findOne({
      ...orgFilter(input.organizationId),
      enabled: true,
      category: input.type === "FIRE" ? "FIRE" : input.type === "MEDICAL" ? "MEDICAL" : input.type === "INTRUSION" ? "INTRUSION" : "SECURITY",
    });
    playbookId = pb?._id.toString() ?? null;
  }

  const mode = input.mode ?? (input.type === "FIRE" ? "EVACUATION" : "EMERGENCY");

  const emergency = await Emergency.create({
    emergencyId,
    organizationId: new mongoose.Types.ObjectId(input.organizationId),
    campusId: input.campusId ? new mongoose.Types.ObjectId(input.campusId) : null,
    type: input.type,
    severity: input.severity ?? "CRITICAL",
    status: "ACTIVE",
    mode,
    reason: input.reason,
    description: input.description ?? "",
    location: input.location ?? {},
    affectedBuildingIds: (input.affectedBuildingIds ?? []).map((id) => new mongoose.Types.ObjectId(id)),
    incidentIds: input.incidentId ? [new mongoose.Types.ObjectId(input.incidentId)] : [],
    teamIds: (input.teamIds ?? []).map((id) => new mongoose.Types.ObjectId(id)),
    playbookId: playbookId ? new mongoose.Types.ObjectId(playbookId) : null,
    timeline: [
      {
        action: "EMERGENCY_ACTIVATED",
        description: `Emergency activated: ${input.type} — ${input.reason}`,
        actorId: new mongoose.Types.ObjectId(input.actor.id),
        actorName: input.actor.name,
        timestamp: new Date(),
      },
    ],
    activatedBy: new mongoose.Types.ObjectId(input.actor.id),
    activatedByName: input.actor.name,
    activatedAt: new Date(),
    source: input.source ?? "MANUAL",
  });

  if (input.incidentId) {
    await Incident.findOneAndUpdate(orgFilter(input.organizationId, { _id: input.incidentId }), {
      emergencyId: emergency._id,
      status: "INVESTIGATING",
    });
    pushTimeline(emergency, {
      action: "INCIDENT_LINKED",
      description: `Incident linked to emergency`,
      actorId: new mongoose.Types.ObjectId(input.actor.id),
      actorName: input.actor.name,
    });
    await emergency.save();
  }

  const state = await getOrCreateOrgEmergencyState(input.organizationId);
  state.mode = mode;
  state.activeEmergencyId = emergency._id;
  await state.save();

  const pub = toPublic(emergency);
  broadcastEmergencyCreated(input.organizationId, pub);
  return pub;
}

export async function listEmergencies(
  organizationId: string,
  filters: { status?: string; type?: string; source?: string; excludeTest?: boolean; page?: number; limit?: number } = {}
) {
  await connectDB();
  const q: Record<string, unknown> = { ...orgFilter(organizationId) };
  if (filters.status) q.status = filters.status;
  if (filters.type) q.type = filters.type;
  if (filters.excludeTest) q.source = { $ne: "TEST" };
  else if (filters.source) q.source = filters.source;

  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 20, 100);
  const [items, total, activeCount] = await Promise.all([
    Emergency.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Emergency.countDocuments(q),
    Emergency.countDocuments(orgFilter(organizationId, { status: { $in: ["ACTIVE", "CONTAINED"] }, source: { $ne: "TEST" } })),
  ]);

  return {
    emergencies: items.map(toPublic),
    total,
    page,
    activeCount,
    stats: {
      active: activeCount,
      resolved: await Emergency.countDocuments(orgFilter(organizationId, { status: "RESOLVED", source: { $ne: "TEST" } })),
    },
  };
}

export async function getEmergencyById(organizationId: string, id: string) {
  await connectDB();
  const emergency = await Emergency.findOne(orgFilter(organizationId, { _id: id }));
  if (!emergency) return null;
  return toPublic(emergency);
}

export async function updateEmergencyStatus(
  organizationId: string,
  id: string,
  status: EmergencyStatus,
  actor: { id: string; name: string },
  notes?: string
) {
  await connectDB();
  const emergency = await Emergency.findOne(orgFilter(organizationId, { _id: id }));
  if (!emergency) return { error: "NOT_FOUND" as const };

  const allowed = EMERGENCY_TRANSITIONS[emergency.status];
  if (!allowed.includes(status)) {
    return { error: "INVALID_TRANSITION" as const, from: emergency.status, to: status };
  }

  emergency.status = status;
  if (notes) emergency.notes = notes;

  if (status === "RESOLVED" || status === "CANCELLED") {
    emergency.resolvedAt = new Date();
    emergency.resolvedBy = new mongoose.Types.ObjectId(actor.id);
    emergency.resolvedByName = actor.name;
    pushTimeline(emergency, {
      action: status === "RESOLVED" ? "EMERGENCY_RESOLVED" : "EMERGENCY_CANCELLED",
      description: status === "RESOLVED" ? "Emergency resolved" : "Emergency cancelled",
      actorId: new mongoose.Types.ObjectId(actor.id),
      actorName: actor.name,
    });
    await closeEscalationsForEmergency(organizationId, emergency._id.toString());
    const state = await getOrCreateOrgEmergencyState(organizationId);
    if (state.activeEmergencyId?.toString() === emergency._id.toString()) {
      const otherActive = await Emergency.findOne(
        orgFilter(organizationId, {
          _id: { $ne: emergency._id },
          status: { $in: ["ACTIVE", "CONTAINED"] },
        })
      );
      if (otherActive) {
        state.mode = otherActive.mode;
        state.activeEmergencyId = otherActive._id;
      } else {
        state.mode = "NORMAL";
        state.activeEmergencyId = null;
      }
      await state.save();
    }
    await emergency.save();
    const pub = toPublic(emergency);
    broadcastEmergencyResolved(organizationId, pub);
    return { emergency: pub };
  }

  pushTimeline(emergency, {
    action: "EMERGENCY_UPDATED",
    description: `Status changed to ${status}`,
    actorId: new mongoose.Types.ObjectId(actor.id),
    actorName: actor.name,
  });
  await emergency.save();
  const pub = toPublic(emergency);
  broadcastEmergencyUpdated(organizationId, pub);
  return { emergency: pub };
}

export async function updateEmergency(
  organizationId: string,
  id: string,
  patch: {
    description?: string;
    notes?: string;
    teamIds?: string[];
    mode?: CampusEmergencyMode;
    location?: IEmergencyLocation;
  },
  actor: { id: string; name: string }
) {
  await connectDB();
  const emergency = await Emergency.findOne(orgFilter(organizationId, { _id: id }));
  if (!emergency) return null;
  if (emergency.status === "RESOLVED" || emergency.status === "CANCELLED") return { error: "CLOSED" as const };

  if (patch.description !== undefined) emergency.description = patch.description;
  if (patch.notes !== undefined) emergency.notes = patch.notes;
  if (patch.location) emergency.location = { ...emergency.location, ...patch.location };
  if (patch.teamIds) {
    emergency.teamIds = patch.teamIds.map((t) => new mongoose.Types.ObjectId(t));
    pushTimeline(emergency, {
      action: "TEAM_ASSIGNED",
      description: `Response teams updated`,
      actorId: new mongoose.Types.ObjectId(actor.id),
      actorName: actor.name,
    });
  }
  if (patch.mode) {
    emergency.mode = patch.mode;
    const state = await getOrCreateOrgEmergencyState(organizationId);
    if (state.activeEmergencyId?.toString() === emergency._id.toString()) {
      state.mode = patch.mode;
      await state.save();
    }
  }

  pushTimeline(emergency, {
    action: "EMERGENCY_UPDATED",
    description: "Emergency details updated",
    actorId: new mongoose.Types.ObjectId(actor.id),
    actorName: actor.name,
  });
  await emergency.save();
  const pub = toPublic(emergency);
  broadcastEmergencyUpdated(organizationId, pub);
  return { emergency: pub };
}

export async function escalateIncidentToEmergency(
  organizationId: string,
  incidentId: string,
  input: {
    type: EmergencyType;
    reason: string;
    description?: string;
    mode?: CampusEmergencyMode;
    actor: { id: string; name: string };
    source?: string;
  }
) {
  await connectDB();
  const incident = await Incident.findOne(orgFilter(organizationId, { _id: incidentId }));
  if (!incident) return { error: "INCIDENT_NOT_FOUND" as const };
  if (incident.emergencyId) {
    const existing = await getEmergencyById(organizationId, incident.emergencyId.toString());
    return { emergency: existing, alreadyLinked: true };
  }

  const emergency = await activateEmergency({
    organizationId,
    type: input.type,
    reason: input.reason,
    description: input.description ?? incident.title,
    mode: input.mode,
    location: {
      building: incident.location.building,
      room: incident.location.room,
      camera: incident.location.camera,
      label: incident.location.label,
    },
    incidentId,
    actor: input.actor,
    source: input.source ?? "MANUAL",
    severity: incident.severity,
  });

  return { emergency };
}

export async function addEmergencyTimelineEntry(
  organizationId: string,
  id: string,
  entry: { action: string; description: string; actor: { id: string; name: string } }
) {
  await connectDB();
  const emergency = await Emergency.findOne(orgFilter(organizationId, { _id: id }));
  if (!emergency) return null;
  pushTimeline(emergency, {
    action: entry.action,
    description: entry.description,
    actorId: new mongoose.Types.ObjectId(entry.actor.id),
    actorName: entry.actor.name,
  });
  await emergency.save();
  const pub = toPublic(emergency);
  broadcastEmergencyUpdated(organizationId, pub);
  return pub;
}

export { toPublic as emergencyToPublic };
