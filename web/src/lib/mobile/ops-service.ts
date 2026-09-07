/**
 * Field ops services: inspections, patrol, equipment, announcements, directory.
 */
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { orgFilter } from "@/lib/campus/service";
import {
  Announcement,
  EquipmentTxn,
  FieldChecklistTemplate,
  FieldEquipment,
  InspectionRun,
  PatrolRoute,
  PatrolRun,
  StaffCertification,
  StaffSkill,
  newMobileId,
} from "@/models/Mobile";
import { createTask } from "@/lib/emergency/task-service";
import { createNotification } from "@/lib/mobile/notification-bridge";
import { logAuditEvent } from "@/lib/audit/log";
import type { IUser } from "@/models/User";
import { User } from "@/models/User";
import { FieldStaffPresence } from "@/models/Mobile";

export async function listDirectory(organizationId: string) {
  await connectDB();
  const users = await User.find({
    organizationId: new mongoose.Types.ObjectId(organizationId),
    status: { $in: ["ACTIVE", "PENDING"] },
  })
    .select("name role professional status lastActive")
    .limit(200);
  const presence = await FieldStaffPresence.find(orgFilter(organizationId));
  const pmap = new Map(presence.map((p) => [p.userId.toString(), p.status]));

  return users.map((u) => ({
    id: u._id.toString(),
    name: u.name,
    role: u.role,
    department: (u as { professional?: { department?: string } }).professional?.department ?? null,
    availability: pmap.get(u._id.toString()) ?? "UNKNOWN",
    note: "Directory shows authorized operational fields only",
  }));
}

export async function listSkills(organizationId: string, userId?: string) {
  await connectDB();
  const q: Record<string, unknown> = { ...orgFilter(organizationId) };
  if (userId) q.userId = new mongoose.Types.ObjectId(userId);
  return StaffSkill.find(q).limit(100);
}

export async function listCertifications(organizationId: string) {
  await connectDB();
  const certs = await StaffCertification.find(orgFilter(organizationId)).limit(200);
  const now = Date.now();
  return certs.map((c) => {
    let status = c.status;
    if (c.expiresAt) {
      const days = (c.expiresAt.getTime() - now) / 864e5;
      if (days < 0) status = "EXPIRED";
      else if (days < 30) status = "EXPIRING";
      else status = "VALID";
    }
    return {
      certificationId: c.certificationId,
      userId: c.userId.toString(),
      name: c.name,
      issuedAt: c.issuedAt?.toISOString() ?? null,
      expiresAt: c.expiresAt?.toISOString() ?? null,
      status,
      note: status === "UNKNOWN" ? "Validity not confirmed without configured dates" : null,
    };
  });
}

export async function listEquipment(organizationId: string) {
  await connectDB();
  const rows = await FieldEquipment.find(orgFilter(organizationId)).limit(100);
  return rows.map((e) => ({
    equipmentId: e.equipmentId,
    name: e.name,
    kind: e.kind,
    status: e.status,
    assignedUserId: e.assignedUserId?.toString() ?? null,
    assignedTeamId: e.assignedTeamId?.toString() ?? null,
    locationLabel: e.locationLabel,
  }));
}

export async function equipmentAction(
  organizationId: string,
  user: IUser,
  equipmentId: string,
  action: "CHECKOUT" | "RETURN" | "MAINTENANCE",
  note?: string
) {
  await connectDB();
  const eq = await FieldEquipment.findOne(orgFilter(organizationId, { equipmentId }));
  if (!eq) return null;
  if (action === "CHECKOUT") {
    eq.status = "CHECKED_OUT";
    eq.assignedUserId = user._id;
  } else if (action === "RETURN") {
    eq.status = "AVAILABLE";
    eq.assignedUserId = null;
  } else {
    eq.status = "MAINTENANCE";
  }
  await eq.save();
  await EquipmentTxn.create({
    txnId: newMobileId("eqt"),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    equipmentId,
    action,
    actorId: user._id,
    note: note ?? "",
  });
  await logAuditEvent({
    actor: user,
    action: "EQUIPMENT_CHECKOUT",
    description: `${action} ${equipmentId}`,
    targetId: equipmentId,
  });
  return eq;
}

export async function listInspections(organizationId: string) {
  await connectDB();
  const now = new Date();
  await InspectionRun.updateMany(
    orgFilter(organizationId, {
      status: "SCHEDULED",
      dueAt: { $lt: now },
    }),
    { $set: { status: "OVERDUE" } }
  );
  const rows = await InspectionRun.find(orgFilter(organizationId)).sort({ dueAt: 1 }).limit(100);
  return rows.map((i) => ({
    inspectionId: i.inspectionId,
    title: i.title,
    status: i.status,
    result: i.result,
    locationLabel: i.locationLabel,
    inspectorName: i.inspectorName,
    dueAt: i.dueAt?.toISOString() ?? null,
    followUpTaskId: i.followUpTaskId,
    demo: i.demo,
  }));
}

export async function completeInspection(
  organizationId: string,
  user: IUser,
  inspectionId: string,
  result: "PASS" | "FAIL" | "WARNING" | "NOT_APPLICABLE",
  notes?: string
) {
  await connectDB();
  const run = await InspectionRun.findOne(orgFilter(organizationId, { inspectionId }));
  if (!run) return null;
  run.result = result;
  run.status = "COMPLETED";
  run.completedAt = new Date();
  run.notes = notes ?? run.notes;
  run.inspectorId = user._id;
  run.inspectorName = user.name;

  if (result === "FAIL") {
    const task = await createTask(
      organizationId,
      {
        title: `Corrective action: ${run.title}`,
        description: `Inspection ${inspectionId} failed. ${notes || ""}`,
        priority: "HIGH",
        source: "INSPECTION",
      },
      { id: user._id.toString(), name: user.name }
    );
    run.followUpTaskId = task.taskId;
  }
  await run.save();
  await logAuditEvent({
    actor: user,
    action: "INSPECTION_COMPLETED",
    description: `Inspection ${inspectionId} → ${result}`,
    targetId: inspectionId,
  });
  return run;
}

export async function listPatrols(organizationId: string) {
  await connectDB();
  const [routes, runs] = await Promise.all([
    PatrolRoute.find(orgFilter(organizationId)).limit(50),
    PatrolRun.find(orgFilter(organizationId)).sort({ createdAt: -1 }).limit(50),
  ]);
  return {
    routes: routes.map((r) => ({
      routeId: r.routeId,
      name: r.name,
      checkpointCount: r.checkpoints.length,
    })),
    runs: runs.map((p) => ({
      patrolId: p.patrolId,
      routeName: p.routeName,
      status: p.status,
      demo: p.demo,
      checks: p.checks,
    })),
  };
}

export async function startPatrol(organizationId: string, user: IUser, routeId: string) {
  await connectDB();
  const route = await PatrolRoute.findOne(orgFilter(organizationId, { routeId }));
  if (!route) return null;
  const run = await PatrolRun.create({
    patrolId: newMobileId("pat"),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    routeId: route.routeId,
    routeName: route.name,
    assignedUserId: user._id,
    status: "STARTED",
    startedAt: new Date(),
    checks: route.checkpoints.map((c) => ({
      checkpointId: c.checkpointId,
      at: null,
      note: "",
      missed: false,
    })),
  });
  await logAuditEvent({
    actor: user,
    action: "PATROL_STARTED",
    description: `Patrol ${run.patrolId} started`,
    targetId: run.patrolId,
  });
  return run;
}

export async function checkPatrolPoint(
  organizationId: string,
  user: IUser,
  patrolId: string,
  checkpointId: string,
  opts: { note?: string; missed?: boolean } = {}
) {
  await connectDB();
  const run = await PatrolRun.findOne(orgFilter(organizationId, { patrolId }));
  if (!run) return null;
  const check = run.checks.find((c) => c.checkpointId === checkpointId);
  if (!check) return { error: "CHECKPOINT_NOT_FOUND" as const };
  check.at = opts.missed ? null : new Date();
  check.missed = Boolean(opts.missed);
  check.note = opts.note ?? "";
  run.status = "IN_PROGRESS";
  if (opts.missed) {
    await createNotification({
      organizationId,
      type: "SYSTEM",
      title: "Patrol checkpoint missed",
      message: `Checkpoint ${checkpointId} on ${run.routeName} marked missed — review required (not automatic misconduct)`,
      severity: "MEDIUM",
      category: "TASKS",
      metadata: { patrolId, checkpointId },
    });
    await logAuditEvent({
      actor: user,
      action: "PATROL_CHECKPOINT_MISSED",
      description: `Missed ${checkpointId} on ${patrolId}`,
      targetId: patrolId,
      severity: "warning",
    });
  }
  const allDone = run.checks.every((c) => c.at || c.missed);
  if (allDone) {
    run.status = "COMPLETED";
    run.completedAt = new Date();
    await logAuditEvent({
      actor: user,
      action: "PATROL_COMPLETED",
      description: `Patrol ${patrolId} completed`,
      targetId: patrolId,
    });
  }
  await run.save();
  return run;
}

export async function scanQrToken(organizationId: string, token: string) {
  await connectDB();
  const route = await PatrolRoute.findOne(
    orgFilter(organizationId, { "checkpoints.qrToken": token })
  );
  if (!route) return { found: false as const };
  const cp = route.checkpoints.find((c) => c.qrToken === token);
  return {
    found: true as const,
    type: "CHECKPOINT" as const,
    routeId: route.routeId,
    checkpoint: cp,
    actions: ["Start Check", "Report Issue"],
  };
}

export async function listAnnouncements(organizationId: string) {
  await connectDB();
  const now = new Date();
  const rows = await Announcement.find(
    orgFilter(organizationId, {
      startsAt: { $lte: now },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    })
  )
    .sort({ createdAt: -1 })
    .limit(50);
  return rows.map((a) => ({
    announcementId: a.announcementId,
    kind: a.kind,
    title: a.testMode ? `[TEST] ${a.title}` : a.title,
    body: a.body,
    severity: a.severity,
    expiresAt: a.expiresAt?.toISOString() ?? null,
    testMode: a.testMode,
    demo: a.demo,
  }));
}

export async function publishAnnouncement(
  organizationId: string,
  user: IUser,
  input: {
    title: string;
    body: string;
    kind?: string;
    severity?: string;
    expiresAt?: string | null;
    testMode?: boolean;
    targets?: Record<string, string[]>;
  }
) {
  await connectDB();
  const kind = (["GENERAL", "CAMPUS", "DEPARTMENT", "EMERGENCY", "MAINTENANCE"].includes(
    String(input.kind || "GENERAL")
  )
    ? String(input.kind || "GENERAL")
    : "GENERAL") as "GENERAL" | "CAMPUS" | "DEPARTMENT" | "EMERGENCY" | "MAINTENANCE";

  const row = await Announcement.create({
    announcementId: newMobileId("ann"),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    title: input.title,
    body: input.body,
    kind,
    severity: input.severity || "NORMAL",
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    testMode: Boolean(input.testMode),
    createdBy: user._id,
    targets: {
      campusIds: input.targets?.campusIds || [],
      buildingIds: input.targets?.buildingIds || [],
      departments: input.targets?.departments || [],
      roles: input.targets?.roles || [],
      teamIds: input.targets?.teamIds || [],
    },
  });
  const announcementId = row.announcementId;
  const title = row.title;
  const body = row.body;
  const testMode = row.testMode;
  await createNotification({
    organizationId,
    type: "ANNOUNCEMENT",
    title,
    message: body.slice(0, 160),
    severity: input.severity === "CRITICAL" ? "CRITICAL" : "MEDIUM",
    category: "ANNOUNCEMENTS",
    testMode,
    metadata: { announcementId },
  });
  await logAuditEvent({
    actor: user,
    action: "ANNOUNCEMENT_PUBLISHED",
    description: `Announcement ${announcementId}${testMode ? " [TEST]" : ""}`,
    targetId: announcementId,
  });
  return row;
}

export async function ensureDefaultChecklists(organizationId: string) {
  await connectDB();
  const count = await FieldChecklistTemplate.countDocuments(orgFilter(organizationId));
  if (count > 0) return;
  const templates = [
    {
      name: "Opening Campus",
      kind: "OPENING",
      items: [
        { key: "gates", label: "Check gates" },
        { key: "cameras", label: "Verify camera status" },
        { key: "lights", label: "Lighting check" },
      ],
    },
    {
      name: "Emergency Inspection",
      kind: "EMERGENCY",
      items: [
        { key: "exits", label: "Exits clear" },
        { key: "assembly", label: "Assembly area ready" },
        { key: "comms", label: "Comms check" },
      ],
    },
  ];
  for (const t of templates) {
    await FieldChecklistTemplate.create({
      checklistId: newMobileId("cl"),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      ...t,
    });
  }
}
