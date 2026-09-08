import { connectDB } from "@/lib/db/connect";
import { orgFilter } from "@/lib/campus/service";
import { getOrCreateOrgEmergencyState } from "@/lib/emergency/emergency-service";
import { Emergency } from "@/models/Emergency";
import { Incident } from "@/models/Incident";
import { Alert } from "@/models/Alert";
import { Camera } from "@/models/Camera";
import { Building } from "@/models/Building";
import { ResponseTeam } from "@/models/ResponseTeam";
import { ResponseTask } from "@/models/ResponseTask";
import { getActiveEscalations } from "@/lib/emergency/escalation-engine";
import { getSocketIO } from "@/lib/monitoring/socket-emitter";
import type { BuildingOpsStatus } from "@/lib/emergency/constants";

export async function getCommandCenterOverview(
  organizationId: string,
  filters: {
    buildingId?: string;
    severity?: string;
    emergencyType?: string;
    incidentStatus?: string;
    teamId?: string;
    assignedTo?: string;
  } = {}
) {
  await connectDB();
  const state = await getOrCreateOrgEmergencyState(organizationId);
  const nonTest = { source: { $ne: "TEST" } };

  const emergencyFilter: Record<string, unknown> = {
    ...orgFilter(organizationId),
    status: { $in: ["ACTIVE", "CONTAINED"] },
    ...nonTest,
  };
  if (filters.emergencyType) emergencyFilter.type = filters.emergencyType;
  if (filters.severity) emergencyFilter.severity = filters.severity;
  if (filters.buildingId) emergencyFilter.affectedBuildingIds = filters.buildingId;

  const incidentFilter: Record<string, unknown> = {
    ...orgFilter(organizationId),
    status: { $in: ["OPEN", "INVESTIGATING", "CONTAINED"] },
    ...nonTest,
  };
  if (filters.incidentStatus) incidentFilter.status = filters.incidentStatus;
  if (filters.severity) incidentFilter.severity = filters.severity;
  if (filters.assignedTo) incidentFilter.assignedTo = filters.assignedTo;
  if (filters.teamId) incidentFilter.assignedTeam = filters.teamId;

  const [
    activeEmergencies,
    activeIncidents,
    criticalAlerts,
    cameras,
    buildings,
    teams,
    openTasks,
    escalations,
  ] = await Promise.all([
    Emergency.find(emergencyFilter).sort({ activatedAt: -1 }).limit(20),
    Incident.find(incidentFilter).sort({ startedAt: -1 }).limit(20),
    Alert.countDocuments(orgFilter(organizationId, { severity: "CRITICAL", status: { $in: ["NEW", "ACKNOWLEDGED", "INVESTIGATING"] } })),
    Camera.find(orgFilter(organizationId)).select("status name cameraId buildingId"),
    Building.find(orgFilter(organizationId)).select("name buildingId status"),
    ResponseTeam.find(orgFilter(organizationId)).sort({ name: 1 }),
    ResponseTask.find(orgFilter(organizationId, { status: { $in: ["PENDING", "IN_PROGRESS"] } })).sort({ createdAt: -1 }).limit(30),
    getActiveEscalations(organizationId),
  ]);

  const online = cameras.filter((c) => c.status === "ONLINE").length;
  const offline = cameras.filter((c) => c.status === "OFFLINE").length;

  const buildingStatuses = buildings.map((b) => {
    const affected = activeEmergencies.some((e) =>
      e.affectedBuildingIds.some((id) => id.toString() === b._id.toString()) ||
      e.location.buildingId === b._id.toString() ||
      e.location.building === b.name
    );
    let opsStatus: BuildingOpsStatus = "NORMAL";
    if (state.mode === "EVACUATION" && affected) opsStatus = "EVACUATING";
    else if (state.mode === "LOCKDOWN" && affected) opsStatus = "RESTRICTED";
    else if (affected && state.mode !== "NORMAL") opsStatus = "EMERGENCY";
    else if (affected) opsStatus = "AFFECTED";
    else if (state.mode === "ELEVATED") opsStatus = "MONITORING";
    return {
      id: b._id.toString(),
      buildingId: b.buildingId,
      name: b.name,
      opsStatus,
    };
  });

  const socketOk = !!getSocketIO();

  return {
    campusStatus: state.mode,
    activeEmergencyId: state.activeEmergencyId?.toString() ?? null,
    cameras: { total: cameras.length, online, offline },
    activeIncidents: activeIncidents.map((i) => ({
      id: i._id.toString(),
      incidentId: i.incidentId,
      title: i.title,
      severity: i.severity,
      status: i.status,
      riskScore: i.riskScore,
      location: i.location,
      assignedToName: i.assignedToName,
      assignedTeamName: i.assignedTeamName,
      startedAt: i.startedAt.toISOString(),
      source: i.source,
    })),
    activeEmergencies: activeEmergencies.map((e) => ({
      id: e._id.toString(),
      emergencyId: e.emergencyId,
      type: e.type,
      severity: e.severity,
      status: e.status,
      mode: e.mode,
      reason: e.reason,
      location: e.location,
      activatedAt: e.activatedAt.toISOString(),
      activatedByName: e.activatedByName,
      source: e.source,
    })),
    criticalAlerts,
    responseTeams: teams.map((t) => ({
      id: t._id.toString(),
      teamId: t.teamId,
      name: t.name,
      type: t.type,
      status: t.status,
      memberCount: t.members.length,
    })),
    openTasks: openTasks.map((t) => ({
      id: t._id.toString(),
      taskId: t.taskId,
      title: t.title,
      status: t.status,
      priority: t.priority,
      emergencyId: t.emergencyId?.toString() ?? null,
      incidentId: t.incidentId?.toString() ?? null,
      assignedToName: t.assignedToName,
    })),
    buildingStatuses,
    escalations,
    systemHealth: {
      websocket: socketOk ? "HEALTHY" : "DEGRADED",
      database: "HEALTHY",
      overall: socketOk ? "HEALTHY" : "DEGRADED",
    },
    stats: {
      activeEmergencies: activeEmergencies.length,
      activeIncidents: activeIncidents.length,
      criticalAlerts,
      camerasOnline: online,
      teamsAvailable: teams.filter((t) => t.status === "AVAILABLE").length,
      openTasks: openTasks.length,
    },
    serverNow: new Date().toISOString(),
  };
}

export async function getEmergencyReport(organizationId: string, emergencyId: string) {
  await connectDB();
  const emergency = await Emergency.findOne(orgFilter(organizationId, { _id: emergencyId }));
  if (!emergency) return null;

  const [incidents, tasks, teams] = await Promise.all([
    Incident.find({ _id: { $in: emergency.incidentIds }, organizationId: emergency.organizationId }),
    ResponseTask.find(orgFilter(organizationId, { emergencyId })),
    ResponseTeam.find({ _id: { $in: emergency.teamIds }, organizationId: emergency.organizationId }),
  ]);

  const activatedAt = emergency.activatedAt.getTime();
  const resolvedAt = emergency.resolvedAt?.getTime() ?? Date.now();
  const durationMs = resolvedAt - activatedAt;

  // Real metrics only from stored timestamps
  const metrics: Record<string, number | null> = {
    totalDurationMs: durationMs,
    detectionToAlertMs: null,
    alertToAckMs: null,
    ackToResponseMs: null,
    responseToResolutionMs: null,
  };

  const timeline = emergency.timeline;
  const activated = timeline.find((t) => t.action === "EMERGENCY_ACTIVATED");
  const teamAssigned = timeline.find((t) => t.action === "TEAM_ASSIGNED");
  const resolved = timeline.find((t) => t.action === "EMERGENCY_RESOLVED" || t.action === "EMERGENCY_CANCELLED");

  if (activated && teamAssigned) {
    metrics.ackToResponseMs = teamAssigned.timestamp.getTime() - activated.timestamp.getTime();
  }
  if (teamAssigned && resolved) {
    metrics.responseToResolutionMs = resolved.timestamp.getTime() - teamAssigned.timestamp.getTime();
  }

  return {
    emergency: {
      id: emergency._id.toString(),
      emergencyId: emergency.emergencyId,
      type: emergency.type,
      severity: emergency.severity,
      status: emergency.status,
      mode: emergency.mode,
      reason: emergency.reason,
      description: emergency.description,
      location: emergency.location,
      notes: emergency.notes,
      source: emergency.source,
      activatedAt: emergency.activatedAt.toISOString(),
      activatedByName: emergency.activatedByName,
      resolvedAt: emergency.resolvedAt?.toISOString() ?? null,
      resolvedByName: emergency.resolvedByName,
      timeline: emergency.timeline.map((t) => ({
        action: t.action,
        description: t.description,
        actorName: t.actorName,
        timestamp: t.timestamp.toISOString(),
      })),
    },
    incidents: incidents.map((i) => ({
      id: i._id.toString(),
      incidentId: i.incidentId,
      title: i.title,
      severity: i.severity,
      status: i.status,
      source: i.source,
    })),
    tasks: tasks.map((t) => ({
      id: t._id.toString(),
      taskId: t.taskId,
      title: t.title,
      status: t.status,
      completedAt: t.completedAt?.toISOString() ?? null,
    })),
    teams: teams.map((t) => ({
      id: t._id.toString(),
      name: t.name,
      type: t.type,
    })),
    metrics,
  };
}
