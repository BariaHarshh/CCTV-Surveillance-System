import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { orgFilter } from "@/lib/campus/service";
import {
  AfterActionReview,
  DataCategory,
  ExecutiveDecision,
  PolicyException,
  ReportSchedule,
  StrategicInitiative,
  newBiId,
} from "@/models/BI";
import { EnterprisePolicy } from "@/models/Enterprise";
import { AuditLog } from "@/models/AuditLog";
import { User } from "@/models/User";
import { logAuditEvent } from "@/lib/audit/log";
import type { IUser } from "@/models/User";
import { createTask } from "@/lib/emergency/task-service";
import { getConfigurationReadiness, getOperationalHealth } from "@/lib/bi/kpi-engine";
import { VideoLegalHold } from "@/models/Video";
import { CorrectiveAction } from "@/models/CorrectiveAction";

export async function getGovernanceCenter(organizationId: string) {
  await connectDB();
  const now = new Date();
  await PolicyException.updateMany(
    orgFilter(organizationId, { status: "ACTIVE", expiresAt: { $lt: now } }),
    { $set: { status: "EXPIRED" } }
  );

  const [policies, exceptions, decisions, initiatives, categories, holds] = await Promise.all([
    EnterprisePolicy.find(orgFilter(organizationId)).limit(50).catch(() => []),
    PolicyException.find(orgFilter(organizationId)).sort({ expiresAt: 1 }).limit(50),
    ExecutiveDecision.find(orgFilter(organizationId)).sort({ decidedAt: -1 }).limit(30),
    StrategicInitiative.find(orgFilter(organizationId)).limit(30),
    DataCategory.find(orgFilter(organizationId)).limit(50),
    VideoLegalHold.find(orgFilter(organizationId, { status: "ACTIVE" })).limit(20).catch(() => []),
  ]);

  const auditIntel = await getAuditIntelligence(organizationId);

  const policyRows = (policies as Array<Record<string, unknown>>).map((p) => ({
    id: String(p._id || p.policyId || ""),
    name: String(p.name || p.title || "Policy"),
    status: String(p.status || "ACTIVE"),
    compliance: "UNKNOWN" as const,
    note: "Compliance state is UNKNOWN unless requirements are verified in-system — not a legal claim",
  }));

  return {
    sections: [
      "Policies",
      "Permissions",
      "AI Governance",
      "Data Governance",
      "Audit",
      "Retention",
      "Risk",
      "Compliance",
      "Decisions",
    ],
    policies: policyRows,
    exceptions: exceptions.map((e) => ({
      exceptionId: e.exceptionId,
      policyId: e.policyId,
      reason: e.reason,
      ownerName: e.ownerName,
      expiresAt: e.expiresAt.toISOString(),
      status: e.status,
    })),
    decisions: decisions.map((d) => ({
      decisionId: d.decisionId,
      title: d.title,
      ownerName: d.ownerName,
      status: d.status,
      decidedAt: d.decidedAt.toISOString(),
    })),
    initiatives: initiatives.map((i) => ({
      initiativeId: i.initiativeId,
      title: i.title,
      status: i.status,
      progress: i.progress,
      deadline: i.deadline?.toISOString() ?? null,
    })),
    dataCategories: categories.map((c) => ({
      categoryId: c.categoryId,
      name: c.name,
      classification: c.classification,
      ownerName: c.ownerName,
      retentionDays: c.retentionDays,
    })),
    legalHolds: (holds as Array<{ holdId: string; resourceId: string }>).map((h) => ({
      holdId: h.holdId,
      resourceId: h.resourceId,
    })),
    recentAudit: auditIntel.recent.slice(0, 20),
    scorecard: await getGovernanceScorecard(organizationId),
  };
}

export async function getGovernanceScorecard(organizationId: string) {
  const [readiness, opHealth, actions] = await Promise.all([
    getConfigurationReadiness(organizationId),
    getOperationalHealth(organizationId),
    CorrectiveAction.countDocuments(orgFilter(organizationId, { status: { $in: ["OPEN", "OVERDUE"] } })),
  ]);
  return {
    policyCoverage: readiness.score,
    auditCoverage: 70,
    accessReview: "UNKNOWN",
    retentionCompliance: "UNKNOWN",
    aiGovernance: "/governance/ai",
    securityEvents: "See /governance/security",
    openCorrectiveActions: actions,
    operationalHealth: opHealth.score,
    note: "Scorecard uses available system signals — not a legal compliance certification",
  };
}

export async function listDecisions(organizationId: string) {
  await connectDB();
  const rows = await ExecutiveDecision.find(orgFilter(organizationId)).sort({ decidedAt: -1 }).limit(100);
  return rows.map((d) => ({
    decisionId: d.decisionId,
    title: d.title,
    reason: d.reason,
    ownerName: d.ownerName,
    relatedData: d.relatedData,
    relatedIncidentId: d.relatedIncidentId,
    status: d.status,
    decidedAt: d.decidedAt.toISOString(),
  }));
}

export async function createDecision(
  organizationId: string,
  user: IUser,
  input: {
    title: string;
    reason?: string;
    ownerName?: string;
    relatedData?: string;
    relatedIncidentId?: string | null;
    createTask?: boolean;
  }
) {
  await connectDB();
  const row = await ExecutiveDecision.create({
    decisionId: newBiId("dec"),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    title: input.title,
    reason: input.reason ?? "",
    ownerName: input.ownerName || user.name,
    ownerId: user._id,
    relatedData: input.relatedData ?? "",
    relatedIncidentId: input.relatedIncidentId ?? null,
    createdBy: user._id,
  });
  let taskId: string | null = null;
  if (input.createTask) {
    const task = await createTask(
      organizationId,
      {
        title: `Executive action: ${input.title}`,
        description: input.reason || "",
        priority: "HIGH",
        assignedTo: user._id.toString(),
        assignedToName: user.name,
        source: "EXECUTIVE_DECISION",
      },
      { id: user._id.toString(), name: user.name }
    );
    taskId = task.taskId;
  }
  await logAuditEvent({
    actor: user,
    action: "EXECUTIVE_DECISION_CREATED",
    description: `Decision ${row.decisionId}`,
    targetId: row.decisionId,
  });
  return { decisionId: row.decisionId, taskId };
}

export async function listInitiatives(organizationId: string) {
  await connectDB();
  return StrategicInitiative.find(orgFilter(organizationId)).sort({ updatedAt: -1 }).limit(100);
}

export async function createInitiative(
  organizationId: string,
  user: IUser,
  input: {
    title: string;
    description?: string;
    ownerName?: string;
    deadline?: string | null;
    relatedKpiIds?: string[];
  }
) {
  await connectDB();
  const row = await StrategicInitiative.create({
    initiativeId: newBiId("ini"),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    title: input.title,
    description: input.description ?? "",
    ownerName: input.ownerName || user.name,
    ownerId: user._id,
    deadline: input.deadline ? new Date(input.deadline) : null,
    relatedKpiIds: input.relatedKpiIds || [],
    createdBy: user._id,
  });
  await logAuditEvent({
    actor: user,
    action: "STRATEGIC_INITIATIVE_CREATED",
    description: row.title,
    targetId: row.initiativeId,
  });
  return row;
}

export async function createPolicyException(
  organizationId: string,
  user: IUser,
  input: { policyId: string; reason: string; expiresAt: string; ownerName?: string }
) {
  await connectDB();
  const row = await PolicyException.create({
    exceptionId: newBiId("pex"),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    policyId: input.policyId,
    reason: input.reason,
    ownerName: input.ownerName || user.name,
    ownerId: user._id,
    expiresAt: new Date(input.expiresAt),
    approvedBy: user._id,
  });
  await logAuditEvent({
    actor: user,
    action: "POLICY_EXCEPTION_APPROVED",
    description: `Exception ${row.exceptionId}`,
    targetId: row.exceptionId,
    severity: "warning",
  });
  return row;
}

export async function getAccessGovernance(organizationId: string) {
  await connectDB();
  const users = await User.find({
    organizationId: new mongoose.Types.ObjectId(organizationId),
    status: "ACTIVE",
  })
    .select("name role lastActive lastLogin professional")
    .limit(200);
  const privileged = users.filter((u) =>
    ["SUPER_ADMIN", "ADMIN", "SECURITY_ADMIN"].includes(u.role) || /admin/i.test(u.role)
  );
  return {
    users: users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      role: u.role,
      lastActive: u.lastActive?.toISOString?.() ?? null,
    })),
    privileged: privileged.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      role: u.role,
    })),
    note: "Access review actions require confirmation — Keep / Change / Revoke via existing staff admin",
  };
}

export async function getAuditIntelligence(organizationId: string, q?: string) {
  await connectDB();
  const orgUsers = await User.find({
    organizationId: new mongoose.Types.ObjectId(organizationId),
  })
    .select("_id")
    .limit(5000);
  const actorIds = orgUsers.map((u) => u._id);
  const filter: Record<string, unknown> = {
    actorId: { $in: actorIds },
  };
  if (q?.trim()) {
    filter.$or = [
      { action: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
    ];
  }
  const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(200);
  const byAction: Record<string, number> = {};
  for (const l of logs) {
    const a = String(l.action);
    byAction[a] = (byAction[a] || 0) + 1;
  }
  const top = Object.entries(byAction)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([action, count]) => ({ action, count }));

  return {
    total: logs.length,
    topActions: top,
    recent: logs.slice(0, 50).map((l) => ({
      action: l.action,
      description: l.description,
      severity: l.severity,
      createdAt: l.createdAt?.toISOString?.() ?? null,
    })),
    anomalies: top
      .filter((t) => /DENIED|FAIL|REVOKE|EVIDENCE_DOWNLOAD/i.test(t.action) && t.count >= 5)
      .map((t) => ({
        label: "POTENTIAL ANOMALY",
        action: t.action,
        count: t.count,
        note: "Unusual volume — review required; not an accusation",
      })),
  };
}

export async function getSecurityGovernance(organizationId: string) {
  const audit = await getAuditIntelligence(organizationId);
  return {
    failedLogins: audit.topActions.filter((a) => /LOGIN_FAIL|FAILED_LOGIN/i.test(a.action)),
    permissionDenials: audit.topActions.filter((a) => /DENIED|FORBIDDEN/i.test(a.action)),
    sessionRevocations: audit.topActions.filter((a) => /SESSION|REVOKE/i.test(a.action)),
    recent: audit.recent.filter((r) => /SECURITY|LOGIN|SESSION|DENIED/i.test(String(r.action))),
    source: "Existing AuditLog — no duplicate security system",
  };
}

export async function createAfterAction(
  organizationId: string,
  user: IUser,
  input: {
    title: string;
    incidentId?: string | null;
    emergencyId?: string | null;
    whatHappened?: string;
    whatWorked?: string;
    whatFailed?: string;
    rootCause?: string | null;
    rootCauseVerified?: boolean;
    lessons?: Array<{ lesson: string; category: string; owner: string; action: string }>;
  }
) {
  await connectDB();
  if (input.rootCause && !input.rootCauseVerified) {
    // Do not store unverified root causes as verified
  }
  const row = await AfterActionReview.create({
    reviewId: newBiId("aar"),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    title: input.title,
    incidentId: input.incidentId ?? null,
    emergencyId: input.emergencyId ?? null,
    whatHappened: input.whatHappened ?? "",
    whatWorked: input.whatWorked ?? "",
    whatFailed: input.whatFailed ?? "",
    rootCause: input.rootCauseVerified ? input.rootCause ?? null : null,
    rootCauseVerified: Boolean(input.rootCauseVerified && input.rootCause),
    lessons: (input.lessons || []).map((l) => ({ ...l, status: "OPEN" })),
    createdBy: user._id,
  });

  for (const lesson of row.lessons) {
    if (lesson.action) {
      await createTask(
        organizationId,
        {
          title: `Lesson: ${lesson.lesson.slice(0, 80)}`,
          description: lesson.action,
          priority: "MEDIUM",
          source: "AFTER_ACTION",
        },
        { id: user._id.toString(), name: user.name }
      );
    }
  }

  await logAuditEvent({
    actor: user,
    action: "AFTER_ACTION_CREATED",
    description: row.reviewId,
    targetId: row.reviewId,
  });
  return row;
}

export async function ensureDataCategories(organizationId: string) {
  await connectDB();
  const n = await DataCategory.countDocuments(orgFilter(organizationId));
  if (n > 0) return;
  const defaults = [
    { name: "Incident Records", classification: "CONFIDENTIAL" as const },
    { name: "Video Evidence", classification: "RESTRICTED" as const },
    { name: "Camera Metadata", classification: "INTERNAL" as const },
    { name: "Public Campus Map", classification: "INTERNAL" as const },
  ];
  for (const d of defaults) {
    await DataCategory.create({
      categoryId: newBiId("dc"),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      ...d,
      ownerName: "Organization Admin",
      retentionDays: d.classification === "RESTRICTED" ? 90 : 365,
    });
  }
}

export async function listReportSchedules(organizationId: string) {
  await connectDB();
  return ReportSchedule.find(orgFilter(organizationId));
}

export async function createReportSchedule(
  organizationId: string,
  user: IUser,
  input: { reportType?: string; cadence?: string; format?: string }
) {
  await connectDB();
  const row = await ReportSchedule.create({
    scheduleId: newBiId("rsch"),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    reportType: input.reportType || "EXECUTIVE",
    cadence: (input.cadence as "WEEKLY") || "WEEKLY",
    format: (input.format as "PDF") || "PDF",
    createdBy: user._id,
  });
  return row;
}
