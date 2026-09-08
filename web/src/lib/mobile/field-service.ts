import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { orgFilter } from "@/lib/campus/service";
import { ResponseTask } from "@/models/ResponseTask";
import { ResponseTeam } from "@/models/ResponseTeam";
import { Alert } from "@/models/Alert";
import { Incident } from "@/models/Incident";
import { Emergency } from "@/models/Emergency";
import { Notification } from "@/models/Notification";
import {
  Announcement,
  FieldCheckIn,
  FieldStaffPresence,
  InspectionRun,
  OpsChannel,
  OpsMessage,
  PatrolRun,
  newMobileId,
} from "@/models/Mobile";
import { listTasks, createTask, updateTask } from "@/lib/emergency/task-service";
import { createNotification } from "@/lib/mobile/notification-bridge";
import { logAuditEvent } from "@/lib/audit/log";
import type { IUser } from "@/models/User";
import type { FieldStaffStatus } from "@/lib/mobile/constants";
import type { ResponseTaskStatus } from "@/lib/emergency/constants";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

export async function getMobileHome(organizationId: string, userId: string) {
  await connectDB();
  const oid = new mongoose.Types.ObjectId(userId);
  const [myTasks, alerts, incidents, emergency, unread, presence] = await Promise.all([
    ResponseTask.find(
      orgFilter(organizationId, {
        assignedTo: oid,
        status: { $in: ["PENDING", "IN_PROGRESS", "PAUSED"] },
      })
    )
      .sort({ dueAt: 1 })
      .limit(20),
    Alert.find(orgFilter(organizationId, { status: { $ne: "RESOLVED" } }))
      .sort({ createdAt: -1 })
      .limit(10),
    Incident.find(
      orgFilter(organizationId, {
        status: { $nin: ["RESOLVED", "CLOSED"] },
        $or: [{ assignedTo: oid }, { assignedTo: null }],
      })
    )
      .sort({ createdAt: -1 })
      .limit(10),
    Emergency.findOne(orgFilter(organizationId, { status: { $in: ["ACTIVE", "CONTAINED"] } })).sort({
      createdAt: -1,
    }),
    Notification.countDocuments(
      orgFilter(organizationId, {
        read: false,
        $or: [{ userId: oid }, { userId: null }],
      })
    ),
    FieldStaffPresence.findOne(orgFilter(organizationId, { userId: oid })),
  ]);

  const overdue = myTasks.filter((t) => t.dueAt && t.dueAt < new Date()).length;

  return {
    greeting: greeting(),
    connectionHint: "Server is authoritative — offline drafts sync when online",
    summary: {
      tasks: myTasks.length,
      overdue,
      alerts: alerts.length,
      assignedIncidents: incidents.filter((i) => i.assignedTo?.equals(oid)).length,
      unreadNotifications: unread,
      emergencyActive: Boolean(emergency),
    },
    myStatus: presence?.status ?? "AVAILABLE",
    locationSharingEnabled: presence?.locationSharingEnabled ?? false,
    locationMeta: presence?.lastLocation?.updatedAt
      ? {
          lastUpdated: presence.lastLocation.updatedAt.toISOString(),
          accuracyM: presence.lastLocation.accuracyM,
          note:
            presence.lastLocation.accuracyM != null && presence.lastLocation.accuracyM > 100
              ? "Accuracy is limited — location is approximate"
              : null,
        }
      : null,
    tasks: myTasks.map(taskBrief),
    alerts: alerts.map((a) => ({
      id: a._id.toString(),
      alertId: a.alertId,
      title: a.title,
      severity: a.severity,
      status: a.status,
    })),
    incidents: incidents.map((i) => ({
      id: i._id.toString(),
      incidentId: i.incidentId,
      title: i.title,
      severity: i.severity,
      status: i.status,
      assigned: Boolean(i.assignedTo?.equals(oid)),
    })),
    emergency: emergency
      ? {
          id: emergency._id.toString(),
          emergencyId: emergency.emergencyId,
          title: (emergency as { title?: string }).title ?? "Active emergency",
          severity: emergency.severity,
          status: emergency.status,
          mode: "EMERGENCY",
        }
      : null,
    quickActions: [
      { label: "Report Incident", href: "/mobile/report" },
      { label: "My Tasks", href: "/tasks" },
      { label: "Map", href: "/mobile/map" },
      { label: "Check In", href: "/mobile?checkin=1" },
    ],
  };
}

function taskBrief(t: InstanceType<typeof ResponseTask>) {
  return {
    id: t._id.toString(),
    taskId: t.taskId,
    title: t.title,
    priority: t.priority,
    status: t.status,
    dueAt: t.dueAt?.toISOString() ?? null,
    overdue: Boolean(t.dueAt && t.dueAt < new Date() && !["COMPLETED", "CANCELLED"].includes(t.status)),
    demo: t.demo,
    href: `/tasks/${t._id.toString()}`,
  };
}

export async function setStaffStatus(
  organizationId: string,
  user: IUser,
  status: FieldStaffStatus,
  note?: string
) {
  await connectDB();
  const presence = await FieldStaffPresence.findOneAndUpdate(
    orgFilter(organizationId, { userId: user._id }),
    {
      $set: {
        status,
        note: note ?? "",
        organizationId: new mongoose.Types.ObjectId(organizationId),
        userId: user._id,
      },
      $setOnInsert: { locationSharingEnabled: false },
    },
    { upsert: true, new: true }
  );
  await logAuditEvent({
    actor: user,
    action: "FIELD_STATUS_CHANGED",
    description: `Staff status → ${status}`,
    metadata: { status, note: note ?? "" },
  });
  return {
    status: presence.status,
    note: presence.note,
    locationSharingEnabled: presence.locationSharingEnabled,
  };
}

export async function setLocationSharing(
  organizationId: string,
  user: IUser,
  enabled: boolean,
  coords?: { lat: number; lng: number; accuracyM?: number | null }
) {
  await connectDB();
  const update: Record<string, unknown> = {
    locationSharingEnabled: enabled,
    organizationId: new mongoose.Types.ObjectId(organizationId),
    userId: user._id,
  };
  if (enabled && coords?.lat != null && coords?.lng != null) {
    update.lastLocation = {
      lat: coords.lat,
      lng: coords.lng,
      accuracyM: coords.accuracyM ?? null,
      updatedAt: new Date(),
    };
  }
  if (!enabled) {
    update.lastLocation = { lat: null, lng: null, accuracyM: null, updatedAt: null };
  }
  const presence = await FieldStaffPresence.findOneAndUpdate(
    orgFilter(organizationId, { userId: user._id }),
    { $set: update, $setOnInsert: { status: "AVAILABLE" } },
    { upsert: true, new: true }
  );
  await logAuditEvent({
    actor: user,
    action: "LOCATION_PERMISSION",
    description: enabled ? "Location sharing enabled by user" : "Location sharing disabled",
    metadata: { enabled, accuracyM: coords?.accuracyM ?? null },
  });
  return {
    locationSharingEnabled: presence.locationSharingEnabled,
    lastLocation: presence.lastLocation,
    privacy:
      "Location is collected only while enabled, for operational response, visible to authorized supervisors per org policy.",
  };
}

export async function submitCheckIn(
  organizationId: string,
  user: IUser,
  input: {
    status: "I_AM_SAFE" | "I_NEED_ASSISTANCE" | "ON_SCENE";
    emergencyId?: string | null;
    note?: string;
    lat?: number | null;
    lng?: number | null;
    accuracyM?: number | null;
    demo?: boolean;
  }
) {
  await connectDB();
  const row = await FieldCheckIn.create({
    checkInId: newMobileId("chk"),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    userId: user._id,
    userName: user.name,
    emergencyId: input.emergencyId ? new mongoose.Types.ObjectId(input.emergencyId) : null,
    status: input.status,
    note: input.note ?? "",
    location: {
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      accuracyM: input.accuracyM ?? null,
    },
    demo: Boolean(input.demo),
  });
  await logAuditEvent({
    actor: user,
    action: "EMERGENCY_CHECKIN",
    description: `Check-in: ${input.status}`,
    metadata: { checkInId: row.checkInId, emergencyId: input.emergencyId ?? null },
  });
  return {
    checkInId: row.checkInId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    note: "Status reflects submitted check-in only — not inferred safety",
  };
}

export async function listMyTasks(
  organizationId: string,
  userId: string,
  filters: { status?: string; priority?: string } = {}
) {
  await connectDB();
  const q: Record<string, unknown> = {
    ...orgFilter(organizationId),
    assignedTo: new mongoose.Types.ObjectId(userId),
  };
  if (filters.status === "OVERDUE") {
    q.status = { $in: ["PENDING", "IN_PROGRESS", "PAUSED"] };
    q.dueAt = { $lt: new Date() };
  } else if (filters.status) {
    q.status = filters.status;
  }
  if (filters.priority) q.priority = filters.priority;
  const tasks = await ResponseTask.find(q).sort({ dueAt: 1, createdAt: -1 }).limit(100);
  return {
    buckets: {
      assigned: tasks.filter((t) => t.status === "PENDING").length,
      inProgress: tasks.filter((t) => t.status === "IN_PROGRESS" || t.status === "PAUSED").length,
      overdue: tasks.filter(
        (t) => t.dueAt && t.dueAt < new Date() && !["COMPLETED", "CANCELLED", "REJECTED"].includes(t.status)
      ).length,
      completed: tasks.filter((t) => t.status === "COMPLETED").length,
    },
    tasks: tasks.map((t) => ({
      ...taskBrief(t),
      description: t.description,
      locationLabel: t.locationLabel,
      checklistDone: t.checklist.filter((c) => c.done).length,
      checklistTotal: t.checklist.length,
    })),
  };
}

export async function getTaskDetail(organizationId: string, taskKey: string) {
  await connectDB();
  const task = await ResponseTask.findOne(
    orgFilter(organizationId, {
      $or: [
        { taskId: taskKey },
        ...(mongoose.Types.ObjectId.isValid(taskKey) ? [{ _id: taskKey }] : []),
      ],
    })
  );
  if (!task) return null;
  return {
    id: task._id.toString(),
    taskId: task.taskId,
    title: task.title,
    description: task.description,
    taskType: task.taskType,
    priority: task.priority,
    status: task.status,
    incidentId: task.incidentId?.toString() ?? null,
    emergencyId: task.emergencyId?.toString() ?? null,
    assignedTo: task.assignedTo?.toString() ?? null,
    assignedToName: task.assignedToName,
    assignedTeam: task.assignedTeam?.toString() ?? null,
    assignedTeamName: task.assignedTeamName,
    dueAt: task.dueAt?.toISOString() ?? null,
    locationLabel: task.locationLabel,
    checklist: task.checklist,
    timeline: task.timeline.map((e) => ({
      action: e.action,
      at: e.at.toISOString(),
      userName: e.userName,
      note: e.note,
    })),
    attachments: task.attachments.map((a) => ({
      type: a.type,
      ref: a.ref,
      name: a.name,
      verified: a.verified,
      note: a.verified ? null : "Uploaded proof is not automatically verified",
      uploadedAt: a.uploadedAt.toISOString(),
    })),
    notes: task.notes,
    sla: {
      acknowledgedAt: task.acknowledgedAt?.toISOString() ?? null,
      startedAt: task.startedAt?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      slaAckMinutes: task.slaAckMinutes,
      slaCompleteMinutes: task.slaCompleteMinutes,
    },
    demo: task.demo,
    links: {
      incident: task.incidentId ? `/admin/incidents/${task.incidentId}` : null,
      map: `/mobile/map?task=${encodeURIComponent(task.taskId)}`,
      video: task.incidentId
        ? `/video/search?incident=${encodeURIComponent(task.incidentId.toString())}`
        : "/video",
    },
  };
}

const ACTION_MAP: Record<string, ResponseTaskStatus | null> = {
  start: "IN_PROGRESS",
  pause: "PAUSED",
  complete: "COMPLETED",
  reject: "REJECTED",
  accept: "IN_PROGRESS",
};

export async function applyTaskAction(
  organizationId: string,
  user: IUser,
  taskKey: string,
  action: string,
  body: Record<string, unknown> = {}
) {
  await connectDB();
  const task = await ResponseTask.findOne(
    orgFilter(organizationId, {
      $or: [
        { taskId: taskKey },
        ...(mongoose.Types.ObjectId.isValid(taskKey) ? [{ _id: taskKey }] : []),
      ],
    })
  );
  if (!task) return { error: "NOT_FOUND" as const };

  const pushTimeline = (act: string, note = "") => {
    task.timeline.push({
      action: act,
      at: new Date(),
      userId: user._id,
      userName: user.name,
      note,
    });
  };

  if (action === "note") {
    const text = String(body.note || "").trim();
    if (!text) return { error: "VALIDATION" as const };
    task.notes.push(text);
    pushTimeline("UPDATED", text);
    await task.save();
    await logAuditEvent({
      actor: user,
      action: "TASK_UPDATED",
      description: `Note on ${task.taskId}`,
      targetId: task.taskId,
    });
    return { ok: true as const, task: await getTaskDetail(organizationId, task._id.toString()) };
  }

  if (action === "checklist") {
    const key = String(body.key || "");
    const item = task.checklist.find((c) => c.key === key);
    if (!item) return { error: "NOT_FOUND" as const };
    item.done = Boolean(body.done);
    item.doneAt = item.done ? new Date() : null;
    item.doneBy = item.done ? user._id : null;
    pushTimeline("UPDATED", `Checklist ${item.label}: ${item.done ? "done" : "undone"}`);
    await task.save();
    return { ok: true as const, task: await getTaskDetail(organizationId, task._id.toString()) };
  }

  if (action === "attach") {
    task.attachments.push({
      type: (String(body.type || "NOTE") as "PHOTO" | "VIDEO" | "DOCUMENT" | "NOTE" | "EVIDENCE_REF"),
      ref: String(body.ref || newMobileId("att")),
      name: String(body.name || "attachment"),
      verified: false,
      uploadedAt: new Date(),
      uploadedBy: user._id,
    });
    pushTimeline("UPDATED", "Attachment added (unverified)");
    await task.save();
    await logAuditEvent({
      actor: user,
      action: "EVIDENCE_UPLOADED",
      description: `Field attachment on ${task.taskId}`,
      targetId: task.taskId,
    });
    return { ok: true as const, task: await getTaskDetail(organizationId, task._id.toString()) };
  }

  if (action === "reassign_request") {
    pushTimeline("UPDATED", `Reassign requested: ${String(body.reason || "")}`);
    await task.save();
    return { ok: true as const, task: await getTaskDetail(organizationId, task._id.toString()) };
  }

  const next = ACTION_MAP[action];
  if (!next) return { error: "UNKNOWN_ACTION" as const };

  const result = await updateTask(
    organizationId,
    task._id.toString(),
    { status: next },
    { id: user._id.toString(), name: user.name }
  );
  if ("error" in result) return result;

  const fresh = await ResponseTask.findById(task._id);
  if (fresh) {
    if (action === "start" || action === "accept") {
      if (!fresh.startedAt) fresh.startedAt = new Date();
      if (!fresh.acknowledgedAt) fresh.acknowledgedAt = new Date();
      fresh.timeline.push({
        action: action === "accept" ? "ACCEPTED" : "STARTED",
        at: new Date(),
        userId: user._id,
        userName: user.name,
        note: "",
      });
    } else if (action === "pause") {
      fresh.timeline.push({
        action: "UPDATED",
        at: new Date(),
        userId: user._id,
        userName: user.name,
        note: "Paused",
      });
    } else if (action === "complete") {
      fresh.timeline.push({
        action: "COMPLETED",
        at: new Date(),
        userId: user._id,
        userName: user.name,
        note: String(body.note || ""),
      });
    } else if (action === "reject") {
      fresh.timeline.push({
        action: "UPDATED",
        at: new Date(),
        userId: user._id,
        userName: user.name,
        note: `Rejected: ${String(body.reason || "")}`,
      });
    }
    await fresh.save();
  }

  await logAuditEvent({
    actor: user,
    action: action === "complete" ? "TASK_COMPLETED" : "TASK_UPDATED",
    description: `Task ${task.taskId} action ${action}`,
    targetId: task.taskId,
  });

  return { ok: true as const, task: await getTaskDetail(organizationId, task._id.toString()) };
}

export async function recommendResponders(
  organizationId: string,
  opts: { skill?: string; priority?: string } = {}
) {
  await connectDB();
  const teams = await ResponseTeam.find(orgFilter(organizationId));
  const presence = await FieldStaffPresence.find(orgFilter(organizationId, { status: "AVAILABLE" }));
  const availableUserIds = new Set(presence.map((p) => p.userId.toString()));

  const scored = teams.map((t) => {
    const reasons: string[] = [];
    let score = 0;
    if (t.status === "AVAILABLE") {
      score += 40;
      reasons.push("Available");
    } else {
      reasons.push(`Team status: ${t.status}`);
    }
    if (!t.currentAssignment) {
      score += 20;
      reasons.push("No current assignment");
    } else {
      score -= 10;
      reasons.push("Has current assignment");
    }
    if (t.mapLocation?.lat != null) {
      score += 15;
      reasons.push(
        t.mapLocation.liveTrackingConfigured
          ? "Location available (live tracking configured)"
          : "Configured location available (not live GPS unless configured)"
      );
    }
    const availableMembers = t.members.filter((m) => availableUserIds.has(m.userId.toString())).length;
    if (availableMembers > 0) {
      score += Math.min(20, availableMembers * 5);
      reasons.push(`${availableMembers} member(s) marked available`);
    }
    if (opts.skill) {
      reasons.push(`Skill preference "${opts.skill}" — verify on staff profile`);
    }
    return {
      teamId: t.teamId,
      id: t._id.toString(),
      name: t.name,
      status: t.status,
      score,
      reasons,
      recommendationOnly: true,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return {
    recommendations: scored.slice(0, 5),
    note: "Recommendations do not override authorization — assigners must still have permission",
  };
}

export async function getTeamsOverview(organizationId: string) {
  await connectDB();
  const teams = await ResponseTeam.find(orgFilter(organizationId));
  return teams.map((t) => ({
    id: t._id.toString(),
    teamId: t.teamId,
    name: t.name,
    type: t.type,
    status: t.status,
    memberCount: t.members.length,
    members: t.members.map((m) => ({ userId: m.userId.toString(), name: m.name, role: m.role })),
    currentAssignment: t.currentAssignment || null,
    location:
      t.mapLocation?.lat != null
        ? {
            lat: t.mapLocation.lat,
            lng: t.mapLocation.lng,
            accuracyM: t.mapLocation.accuracyM,
            live: Boolean(t.mapLocation.liveTrackingConfigured),
            lastUpdated: t.mapLocation.lastUpdated?.toISOString() ?? null,
            note: t.mapLocation.liveTrackingConfigured
              ? null
              : "Configured location — not live GPS",
          }
        : null,
    supervisor: t.members.find((m) => /supervisor|lead|captain/i.test(m.role))?.name ?? null,
    href: `/teams/${t._id.toString()}`,
  }));
}

export async function getTeamDetail(organizationId: string, teamKey: string) {
  await connectDB();
  const team = await ResponseTeam.findOne(
    orgFilter(organizationId, {
      $or: [
        { teamId: teamKey },
        ...(mongoose.Types.ObjectId.isValid(teamKey) ? [{ _id: teamKey }] : []),
      ],
    })
  );
  if (!team) return null;
  const tasks = await ResponseTask.find(
    orgFilter(organizationId, {
      assignedTeam: team._id,
      status: { $in: ["PENDING", "IN_PROGRESS", "PAUSED"] },
    })
  ).limit(30);
  const incidents = await Incident.find(
    orgFilter(organizationId, { status: { $nin: ["RESOLVED", "CLOSED"] } })
  ).limit(20);

  return {
    team: {
      id: team._id.toString(),
      teamId: team.teamId,
      name: team.name,
      status: team.status,
      type: team.type,
      currentAssignment: team.currentAssignment,
      members: team.members.map((m) => ({
        userId: m.userId.toString(),
        name: m.name,
        role: m.role,
      })),
    },
    tasks: tasks.map(taskBrief),
    incidents: incidents.map((i) => ({
      id: i._id.toString(),
      incidentId: i.incidentId,
      title: i.title,
      status: i.status,
    })),
    recentActivity: tasks.slice(0, 10).map((t) => ({
      text: `${t.taskId} · ${t.status}`,
      at: t.updatedAt.toISOString(),
    })),
  };
}

export async function getOrCreateChannel(
  organizationId: string,
  kind: "INCIDENT" | "EMERGENCY" | "TEAM" | "TASK",
  refId: string,
  title: string
) {
  await connectDB();
  let ch = await OpsChannel.findOne(orgFilter(organizationId, { kind, refId }));
  if (!ch) {
    ch = await OpsChannel.create({
      channelId: newMobileId("ch"),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      kind,
      refId,
      title,
    });
  }
  return ch;
}

export async function listChannelMessages(organizationId: string, channelId: string) {
  await connectDB();
  const msgs = await OpsMessage.find(
    orgFilter(organizationId, { channelId, status: { $ne: "SOFT_DELETED" } })
  )
    .sort({ createdAt: 1 })
    .limit(200);
  return msgs.map((m) => ({
    messageId: m.messageId,
    content: m.content,
    senderName: m.senderName,
    isSystemEvent: m.isSystemEvent,
    status: m.status,
    attachments: m.attachments,
    editedAt: m.editedAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
    demo: m.demo,
  }));
}

export async function postChannelMessage(
  organizationId: string,
  user: IUser,
  channelId: string,
  content: string,
  attachments: Array<{ type: string; ref: string; name: string }> = []
) {
  await connectDB();
  const ch = await OpsChannel.findOne(orgFilter(organizationId, { channelId }));
  if (!ch) return null;
  const msg = await OpsMessage.create({
    messageId: newMobileId("msg"),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    channelId,
    senderId: user._id,
    senderName: user.name,
    content,
    attachments,
    isSystemEvent: false,
  });
  await logAuditEvent({
    actor: user,
    action: "MESSAGE_SENT",
    description: `Message in ${channelId}`,
    targetId: msg.messageId,
  });
  return msg;
}

export async function postSystemMessage(
  organizationId: string,
  channelId: string,
  content: string
) {
  await connectDB();
  return OpsMessage.create({
    messageId: newMobileId("msg"),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    channelId,
    senderId: null,
    senderName: "System",
    content,
    isSystemEvent: true,
  });
}

export async function getFieldDashboard(organizationId: string, userId: string) {
  const home = await getMobileHome(organizationId, userId);
  await connectDB();
  const [patrols, inspections] = await Promise.all([
    PatrolRun.find(
      orgFilter(organizationId, {
        assignedUserId: new mongoose.Types.ObjectId(userId),
        status: { $in: ["SCHEDULED", "STARTED", "IN_PROGRESS"] },
      })
    ).limit(10),
    InspectionRun.find(
      orgFilter(organizationId, {
        inspectorId: new mongoose.Types.ObjectId(userId),
        status: { $in: ["SCHEDULED", "ACTIVE", "OVERDUE"] },
      })
    ).limit(10),
  ]);
  return {
    ...home,
    patrols: patrols.map((p) => ({
      patrolId: p.patrolId,
      routeName: p.routeName,
      status: p.status,
      demo: p.demo,
    })),
    inspections: inspections.map((i) => ({
      inspectionId: i.inspectionId,
      title: i.title,
      status: i.status,
      result: i.result,
      demo: i.demo,
    })),
  };
}

export async function getSupervisorDashboard(organizationId: string) {
  await connectDB();
  const [teams, tasks, incidents, patrols, inspections] = await Promise.all([
    ResponseTeam.find(orgFilter(organizationId)),
    ResponseTask.find(orgFilter(organizationId, { status: { $in: ["PENDING", "IN_PROGRESS", "PAUSED"] } })).limit(
      50
    ),
    Incident.find(orgFilter(organizationId, { status: { $nin: ["RESOLVED", "CLOSED"] } })).limit(30),
    PatrolRun.find(orgFilter(organizationId, { status: { $in: ["SCHEDULED", "IN_PROGRESS", "MISSED"] } })).limit(
      20
    ),
    InspectionRun.find(orgFilter(organizationId, { status: { $in: ["SCHEDULED", "ACTIVE", "OVERDUE"] } })).limit(
      20
    ),
  ]);
  const overdue = tasks.filter((t) => t.dueAt && t.dueAt < new Date());
  return {
    teams: teams.map((t) => ({ teamId: t.teamId, name: t.name, status: t.status })),
    openTasks: tasks.length,
    overdueTasks: overdue.length,
    openIncidents: incidents.length,
    patrols: patrols.length,
    inspections: inspections.length,
    note: "Operational KPIs — not employee performance evaluations unless org policy defines that use",
    tasks: tasks.slice(0, 15).map(taskBrief),
  };
}

export async function getOperationsDashboard(organizationId: string) {
  const supervisor = await getSupervisorDashboard(organizationId);
  await connectDB();
  const [alerts, emergency, announcements, checkIns] = await Promise.all([
    Alert.countDocuments(orgFilter(organizationId, { status: { $ne: "RESOLVED" } })),
    Emergency.findOne(orgFilter(organizationId, { status: { $in: ["ACTIVE", "CONTAINED"] } })),
    Announcement.find(
      orgFilter(organizationId, {
        startsAt: { $lte: new Date() },
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      })
    ).limit(10),
    FieldCheckIn.find(orgFilter(organizationId)).sort({ createdAt: -1 }).limit(30),
  ]);
  return {
    ...supervisor,
    activeAlerts: alerts,
    emergency: emergency
      ? { emergencyId: emergency.emergencyId, status: emergency.status, severity: emergency.severity }
      : null,
    announcements: announcements.map((a) => ({
      announcementId: a.announcementId,
      title: a.title,
      kind: a.kind,
      testMode: a.testMode,
      demo: a.demo,
    })),
    checkIns: checkIns.map((c) => ({
      checkInId: c.checkInId,
      userName: c.userName,
      status: c.status,
      at: c.createdAt.toISOString(),
      note: "Submitted status only",
    })),
    links: {
      map: "/map",
      video: "/command/video-wall",
      communication: "/communication",
    },
  };
}

export async function getOperationsAnalytics(organizationId: string) {
  await connectDB();
  const since = new Date(Date.now() - 30 * 864e5);
  const tasks = await ResponseTask.find(orgFilter(organizationId, { createdAt: { $gte: since } }));
  const completed = tasks.filter((t) => t.status === "COMPLETED");
  const withSla = completed.filter((t) => t.startedAt && t.completedAt);
  const avgResponseMs =
    withSla.length === 0
      ? null
      : withSla.reduce((s, t) => s + (t.completedAt!.getTime() - t.startedAt!.getTime()), 0) /
        withSla.length;
  const inspections = await InspectionRun.find(orgFilter(organizationId, { createdAt: { $gte: since } }));
  const patrols = await PatrolRun.find(orgFilter(organizationId, { createdAt: { $gte: since } }));

  return {
    rangeDays: 30,
    tasks: {
      total: tasks.length,
      completed: completed.length,
      overdue: tasks.filter(
        (t) => t.dueAt && t.dueAt < new Date() && !["COMPLETED", "CANCELLED", "REJECTED"].includes(t.status)
      ).length,
      avgCompletionMinutes: avgResponseMs != null ? Math.round(avgResponseMs / 60000) : null,
    },
    inspections: {
      total: inspections.length,
      completed: inspections.filter((i) => i.status === "COMPLETED").length,
      failed: inspections.filter((i) => i.result === "FAIL").length,
    },
    patrols: {
      total: patrols.length,
      completed: patrols.filter((p) => p.status === "COMPLETED").length,
      missed: patrols.filter((p) => p.status === "MISSED").length,
    },
    disclaimer: "Operational KPIs only — not automatic employee performance judgments",
  };
}

/** Re-export for mobile incident create path */
export { createTask, listTasks };
