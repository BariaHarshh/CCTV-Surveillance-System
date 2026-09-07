import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { orgFilter } from "@/lib/campus/service";
import { getNextSequence, formatEscalationRuleId } from "@/models/Counter";
import { EscalationRule, ActiveEscalation, type IEscalationRule } from "@/models/EscalationRule";
import { DEFAULT_ESCALATION_RULES, ESCALATION_LEVELS, type EscalationLevel } from "@/lib/emergency/constants";
import type { SeverityLevel } from "@/lib/monitoring/constants";
import { broadcastEscalationTriggered } from "@/lib/monitoring/socket-emitter";
import { Notification } from "@/models/Notification";
import { getNextSequence as nextSeq, formatNotificationId } from "@/models/Counter";

const LEVEL_LABELS: Record<EscalationLevel, string> = {
  LEVEL_1: "Security Staff",
  LEVEL_2: "Security Supervisor",
  LEVEL_3: "Campus Admin",
  LEVEL_4: "Emergency Leadership",
};

function ruleToPublic(r: IEscalationRule) {
  return {
    id: r._id.toString(),
    ruleId: r.ruleId,
    name: r.name,
    eventTypes: r.eventTypes,
    severity: r.severity,
    levels: r.levels.map((l) => ({
      level: l.level,
      roleLabel: l.roleLabel,
      timeoutMinutes: l.timeoutMinutes,
      teamId: l.teamId?.toString() ?? null,
    })),
    timeoutMinutes: r.timeoutMinutes,
    enabled: r.enabled,
    source: r.source,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function ensureDefaultEscalationRules(organizationId: string) {
  await connectDB();
  const count = await EscalationRule.countDocuments(orgFilter(organizationId));
  if (count > 0) return;
  for (const def of DEFAULT_ESCALATION_RULES) {
    const seq = await getNextSequence("escalation");
    await EscalationRule.create({
      ruleId: await formatEscalationRuleId(seq),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      name: def.name,
      eventTypes: def.eventTypes,
      severity: def.severity,
      timeoutMinutes: def.timeoutMinutes,
      levels: def.levels.map((level, i) => ({
        level,
        roleLabel: LEVEL_LABELS[level],
        timeoutMinutes: def.timeoutMinutes * (i + 1),
      })),
      enabled: true,
      source: "SYSTEM",
    });
  }
}

export async function listEscalationRules(organizationId: string) {
  await ensureDefaultEscalationRules(organizationId);
  const rules = await EscalationRule.find(orgFilter(organizationId)).sort({ severity: -1 });
  return rules.map(ruleToPublic);
}

export async function createEscalationRule(
  organizationId: string,
  data: {
    name: string;
    severity: SeverityLevel;
    eventTypes?: string[];
    timeoutMinutes?: number;
    levels?: Array<{ level: EscalationLevel; roleLabel?: string; timeoutMinutes?: number; teamId?: string | null }>;
  }
) {
  await connectDB();
  const seq = await getNextSequence("escalation");
  const levels = data.levels?.length
    ? data.levels
    : ESCALATION_LEVELS.slice(0, 3).map((level, i) => ({
        level,
        roleLabel: LEVEL_LABELS[level],
        timeoutMinutes: (data.timeoutMinutes ?? 10) * (i + 1),
      }));

  const rule = await EscalationRule.create({
    ruleId: await formatEscalationRuleId(seq),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    name: data.name,
    severity: data.severity,
    eventTypes: data.eventTypes ?? [],
    timeoutMinutes: data.timeoutMinutes ?? 10,
    levels: levels.map((l) => ({
      level: l.level,
      roleLabel: l.roleLabel ?? LEVEL_LABELS[l.level],
      timeoutMinutes: l.timeoutMinutes ?? data.timeoutMinutes ?? 10,
      teamId: "teamId" in l && l.teamId ? new mongoose.Types.ObjectId(l.teamId) : null,
    })),
    enabled: true,
  });
  return ruleToPublic(rule);
}

export async function updateEscalationRule(
  organizationId: string,
  id: string,
  patch: Partial<{ name: string; enabled: boolean; timeoutMinutes: number; eventTypes: string[]; levels: IEscalationRule["levels"] }>
) {
  await connectDB();
  const rule = await EscalationRule.findOne(orgFilter(organizationId, { _id: id }));
  if (!rule) return null;
  if (patch.name !== undefined) rule.name = patch.name;
  if (patch.enabled !== undefined) rule.enabled = patch.enabled;
  if (patch.timeoutMinutes !== undefined) rule.timeoutMinutes = patch.timeoutMinutes;
  if (patch.eventTypes !== undefined) rule.eventTypes = patch.eventTypes;
  if (patch.levels !== undefined) rule.levels = patch.levels;
  await rule.save();
  return ruleToPublic(rule);
}

/** Start escalation for an emergency/incident — timers are server-authoritative */
export async function startEscalation(input: {
  organizationId: string;
  emergencyId?: string | null;
  incidentId?: string | null;
  alertId?: string | null;
  severity: SeverityLevel;
  source?: string;
}) {
  await connectDB();
  await ensureDefaultEscalationRules(input.organizationId);

  const rule = await EscalationRule.findOne({
    ...orgFilter(input.organizationId),
    severity: input.severity,
    enabled: true,
  }).sort({ createdAt: 1 });

  if (!rule || rule.levels.length === 0) return null;

  const first = rule.levels[0];
  const timeoutMs = (first.timeoutMinutes || rule.timeoutMinutes) * 60 * 1000;
  const now = new Date();

  let deliveryStatus: "PENDING" | "DELIVERED" | "FAILED" = "PENDING";
  try {
    const nseq = await nextSeq("notification");
      await Notification.create({
      notificationId: await formatNotificationId(nseq),
      organizationId: new mongoose.Types.ObjectId(input.organizationId),
      userId: null,
      type: "ALERT",
      title: `Escalation ${first.level}`,
      message: `${LEVEL_LABELS[first.level as EscalationLevel]} — response required`,
      severity: input.severity,
      read: false,
      metadata: { escalationLevel: first.level, emergencyId: input.emergencyId, incidentId: input.incidentId },
    });
    deliveryStatus = "DELIVERED";
  } catch {
    deliveryStatus = "FAILED";
  }

  const active = await ActiveEscalation.create({
    organizationId: new mongoose.Types.ObjectId(input.organizationId),
    emergencyId: input.emergencyId ? new mongoose.Types.ObjectId(input.emergencyId) : null,
    incidentId: input.incidentId ? new mongoose.Types.ObjectId(input.incidentId) : null,
    alertId: input.alertId ? new mongoose.Types.ObjectId(input.alertId) : null,
    ruleId: rule._id,
    currentLevel: first.level,
    levelIndex: 0,
    status: "ACTIVE",
    nextEscalationAt: new Date(now.getTime() + timeoutMs),
    deliveryStatus,
    history: [{ level: first.level, triggeredAt: now, notified: deliveryStatus === "DELIVERED" }],
    source: input.source ?? "SYSTEM",
  });

  broadcastEscalationTriggered(input.organizationId, {
    id: active._id.toString(),
    level: first.level,
    nextEscalationAt: active.nextEscalationAt?.toISOString() ?? null,
    deliveryStatus,
    emergencyId: input.emergencyId,
    incidentId: input.incidentId,
  });

  return {
    id: active._id.toString(),
    currentLevel: active.currentLevel,
    status: active.status,
    nextEscalationAt: active.nextEscalationAt?.toISOString() ?? null,
    deliveryStatus: active.deliveryStatus,
    roleLabel: first.roleLabel,
  };
}

export async function acknowledgeEscalation(
  organizationId: string,
  escalationId: string,
  actor: { id: string; name: string }
) {
  await connectDB();
  const esc = await ActiveEscalation.findOne(orgFilter(organizationId, { _id: escalationId }));
  if (!esc) return null;
  if (esc.status !== "ACTIVE") return { error: "NOT_ACTIVE" as const };

  esc.status = "ACKNOWLEDGED";
  esc.acknowledgedAt = new Date();
  esc.acknowledgedBy = new mongoose.Types.ObjectId(actor.id);
  esc.acknowledgedByName = actor.name;
  esc.nextEscalationAt = null;
  await esc.save();

  return {
    id: esc._id.toString(),
    status: esc.status,
    acknowledgedAt: esc.acknowledgedAt.toISOString(),
    currentLevel: esc.currentLevel,
  };
}

/** Process due escalations — server clock only */
export async function processDueEscalations(organizationId?: string) {
  await connectDB();
  const now = new Date();
  const filter: Record<string, unknown> = {
    status: "ACTIVE",
    nextEscalationAt: { $lte: now },
  };
  if (organizationId) filter.organizationId = new mongoose.Types.ObjectId(organizationId);

  const due = await ActiveEscalation.find(filter).limit(50);
  const results = [];

  for (const esc of due) {
    const rule = esc.ruleId ? await EscalationRule.findById(esc.ruleId) : null;
    const nextIndex = esc.levelIndex + 1;
    if (!rule || nextIndex >= rule.levels.length) {
      esc.status = "TIMED_OUT";
      esc.nextEscalationAt = null;
      await esc.save();
      results.push({ id: esc._id.toString(), status: "TIMED_OUT" });
      continue;
    }

    const next = rule.levels[nextIndex];
    esc.levelIndex = nextIndex;
    esc.currentLevel = next.level;
    const timeoutMs = (next.timeoutMinutes || rule.timeoutMinutes) * 60 * 1000;
    esc.nextEscalationAt = new Date(Date.now() + timeoutMs);

    let deliveryStatus: "PENDING" | "DELIVERED" | "FAILED" = "PENDING";
    try {
      const nseq = await nextSeq("notification");
      await Notification.create({
        notificationId: await formatNotificationId(nseq),
        organizationId: esc.organizationId,
        userId: null,
        type: "ALERT",
        title: `Escalation ${next.level}`,
        message: `${next.roleLabel || LEVEL_LABELS[next.level]} — escalation advanced`,
        severity: "HIGH",
        read: false,
        metadata: { escalationLevel: next.level, emergencyId: esc.emergencyId?.toString() },
      });
      deliveryStatus = "DELIVERED";
    } catch {
      deliveryStatus = "FAILED";
    }
    esc.deliveryStatus = deliveryStatus;
    esc.history.push({ level: next.level, triggeredAt: new Date(), notified: deliveryStatus === "DELIVERED" });
    await esc.save();

    broadcastEscalationTriggered(esc.organizationId.toString(), {
      id: esc._id.toString(),
      level: next.level,
      nextEscalationAt: esc.nextEscalationAt?.toISOString() ?? null,
      deliveryStatus,
    });
    results.push({ id: esc._id.toString(), level: next.level, deliveryStatus });
  }

  return results;
}

export async function closeEscalationsForEmergency(organizationId: string, emergencyId: string) {
  await connectDB();
  await ActiveEscalation.updateMany(
    orgFilter(organizationId, { emergencyId, status: { $in: ["ACTIVE", "ACKNOWLEDGED"] } }),
    { $set: { status: "CLOSED", nextEscalationAt: null } }
  );
}

export async function getActiveEscalations(organizationId: string, emergencyId?: string) {
  await connectDB();
  // Process due timers before returning (server-authoritative)
  await processDueEscalations(organizationId);
  const q: Record<string, unknown> = { ...orgFilter(organizationId), status: { $in: ["ACTIVE", "ACKNOWLEDGED"] } };
  if (emergencyId) q.emergencyId = emergencyId;
  const items = await ActiveEscalation.find(q).sort({ createdAt: -1 });
  return items.map((e) => ({
    id: e._id.toString(),
    emergencyId: e.emergencyId?.toString() ?? null,
    incidentId: e.incidentId?.toString() ?? null,
    currentLevel: e.currentLevel,
    status: e.status,
    nextEscalationAt: e.nextEscalationAt?.toISOString() ?? null,
    acknowledgedAt: e.acknowledgedAt?.toISOString() ?? null,
    acknowledgedByName: e.acknowledgedByName,
    deliveryStatus: e.deliveryStatus,
    history: e.history,
    serverNow: new Date().toISOString(),
  }));
}

export const escalationEngine = {
  start: startEscalation,
  acknowledge: acknowledgeEscalation,
  processDue: processDueEscalations,
  closeForEmergency: closeEscalationsForEmergency,
  listRules: listEscalationRules,
  createRule: createEscalationRule,
  updateRule: updateEscalationRule,
  getActive: getActiveEscalations,
};
