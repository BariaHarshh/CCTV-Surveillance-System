import crypto from "crypto";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { AgentRegistry, AgentTrace, OrgAutonomySettings, newEnterpriseId } from "@/models/Enterprise";
import { evaluatePolicy } from "./policy-engine";
import { createApprovalRequest } from "./approval-service";
import type { IUser } from "@/models/User";
import { logAuditEvent } from "@/lib/audit/log";

const DEFAULT_AGENTS = [
  {
    agentId: "agent_copilot",
    name: "AI Copilot Agent",
    type: "COPILOT",
    riskLevel: "MEDIUM",
    tools: ["getIncidents", "getAlerts", "getCameras", "searchKnowledge"],
    permissions: ["ai:view", "incident:view", "alert:view"],
    actionMode: "RECOMMEND",
  },
  {
    agentId: "agent_safety",
    name: "Safety Analysis Agent",
    type: "SAFETY_ANALYSIS",
    riskLevel: "LOW",
    tools: ["getAnalytics", "getDashboardSummary"],
    permissions: ["analytics:view"],
    actionMode: "OBSERVE",
  },
  {
    agentId: "agent_incident",
    name: "Incident Analysis Agent",
    type: "INCIDENT_ANALYSIS",
    riskLevel: "MEDIUM",
    tools: ["getIncidents", "getIncidentDetails"],
    permissions: ["incident:view"],
    actionMode: "RECOMMEND",
  },
  {
    agentId: "agent_report",
    name: "Report Agent",
    type: "REPORT",
    riskLevel: "MEDIUM",
    tools: ["getReports", "generateReport"],
    permissions: ["report:view"],
    actionMode: "DRAFT",
  },
  {
    agentId: "agent_risk",
    name: "Risk Agent",
    type: "RISK",
    riskLevel: "LOW",
    tools: ["getPredictiveRisk", "getRecommendations"],
    permissions: ["analytics:view"],
    actionMode: "OBSERVE",
  },
  {
    agentId: "agent_camera",
    name: "Camera Health Agent",
    type: "CAMERA_HEALTH",
    riskLevel: "LOW",
    tools: ["getCameras", "getOfflineCameras", "getCameraHealth"],
    permissions: ["camera:view"],
    actionMode: "RECOMMEND",
  },
  {
    agentId: "agent_notification",
    name: "Notification Agent",
    type: "NOTIFICATION",
    riskLevel: "HIGH",
    tools: ["notifyUser"],
    permissions: ["notification:send"],
    actionMode: "APPROVAL",
  },
  {
    agentId: "agent_workflow",
    name: "Workflow Agent",
    type: "WORKFLOW",
    riskLevel: "HIGH",
    tools: ["runAutomation"],
    permissions: ["automation:execute"],
    actionMode: "APPROVAL",
  },
] as const;

export async function ensureDefaultAgents() {
  await connectDB();
  for (const a of DEFAULT_AGENTS) {
    await AgentRegistry.findOneAndUpdate(
      { agentId: a.agentId },
      {
        $setOnInsert: {
          ...a,
          description: `${a.name} — limited purpose enterprise agent`,
          version: "1.0.0",
          status: "ACTIVE",
          organizationScope: "ALL",
          organizationIds: [],
          model: "tools",
        },
      },
      { upsert: true }
    );
  }
}

export async function getOrCreateAutonomy(organizationId: string) {
  await connectDB();
  let doc = await OrgAutonomySettings.findOne({ organizationId: new mongoose.Types.ObjectId(organizationId) });
  if (!doc) {
    doc = await OrgAutonomySettings.create({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      defaultMode: "RECOMMEND",
      agentModes: {
        COPILOT: "RECOMMEND",
        REPORT: "DRAFT",
        NOTIFICATION: "APPROVAL",
        SAFETY_ANALYSIS: "OBSERVE",
      },
      aiWriteActionsEnabled: false,
      aiExternalCommunicationEnabled: false,
      aiAnalysisEnabled: true,
    });
  }
  return doc;
}

export async function killSwitchAgent(opts: {
  agentId: string;
  user: IUser;
  reason: string;
}) {
  await connectDB();
  const agent = await AgentRegistry.findOne({ agentId: opts.agentId });
  if (!agent) throw new Error("Agent not found");
  agent.status = "DISABLED";
  agent.disabledReason = opts.reason;
  agent.disabledBy = opts.user._id as mongoose.Types.ObjectId;
  agent.disabledAt = new Date();
  await agent.save();
  await logAuditEvent({
    actor: opts.user,
    action: "AGENT_DISABLED",
    description: `Agent ${opts.agentId} disabled: ${opts.reason}`,
  }).catch(() => undefined);
  return agent;
}

/**
 * Deterministic agent execution gate:
 * User → Agent → Tool → Policy → Approval → Execute → Audit
 * The model is never the authorization boundary.
 */
export async function executeAgentTool(opts: {
  organizationId: string;
  user: IUser;
  agentId: string;
  tool: string;
  args?: Record<string, unknown>;
  requestSummary: string;
}) {
  await connectDB();
  await ensureDefaultAgents();
  const agent = await AgentRegistry.findOne({ agentId: opts.agentId });
  if (!agent) throw new Error("Agent not found");
  if (agent.status === "DISABLED") throw new Error("Agent disabled");

  const autonomy = await getOrCreateAutonomy(opts.organizationId);
  if (!autonomy.aiAnalysisEnabled && agent.type !== "COPILOT") {
    throw new Error("AI analysis disabled by organization kill switch");
  }

  const isWrite = /create|update|delete|notify|generate|run/i.test(opts.tool);
  if (isWrite && !autonomy.aiWriteActionsEnabled && agent.actionMode === "AUTONOMOUS") {
    throw new Error("AI write actions disabled");
  }

  if (!agent.tools.includes(opts.tool) && !agent.tools.includes("*")) {
    throw new Error("Tool not registered for this agent");
  }

  const policy = await evaluatePolicy({
    subject: {
      userId: opts.user._id.toString(),
      role: opts.user.role,
      agentId: opts.agentId,
      organizationId: opts.organizationId,
    },
    action: opts.tool,
    resourceType: "AGENT_TOOL",
  });

  const correlationId = crypto.randomUUID();
  const argumentsHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(opts.args ?? {}))
    .digest("hex")
    .slice(0, 16);

  if (policy.effect === "DENY") {
    await AgentTrace.create({
      traceId: newEnterpriseId("trc"),
      organizationId: new mongoose.Types.ObjectId(opts.organizationId),
      userId: opts.user._id,
      agentId: opts.agentId,
      requestSummary: opts.requestSummary.slice(0, 500),
      tool: opts.tool,
      argumentsHash,
      policyDecision: "DENY",
      result: policy.reason,
      outcome: "DENIED",
      correlationId,
      safeReasoning: `Selected tool "${opts.tool}" was denied by policy.`,
    });
    throw new Error(policy.reason);
  }

  const mode = autonomy.agentModes?.[agent.type] ?? agent.actionMode ?? autonomy.defaultMode;
  if (policy.effect === "REQUIRE_APPROVAL" || mode === "APPROVAL" || (isWrite && mode !== "AUTONOMOUS")) {
    const approval = await createApprovalRequest({
      organizationId: opts.organizationId,
      requestedBy: opts.user._id as mongoose.Types.ObjectId,
      requestedByType: "AI",
      action: opts.tool,
      resourceType: "AGENT_TOOL",
      resourceId: opts.agentId,
      riskLevel: agent.riskLevel,
      reason: `Agent ${agent.name} requests ${opts.tool}`,
      correlationId,
      payload: { args: opts.args ?? {} },
    });
    await AgentTrace.create({
      traceId: newEnterpriseId("trc"),
      organizationId: new mongoose.Types.ObjectId(opts.organizationId),
      userId: opts.user._id,
      agentId: opts.agentId,
      requestSummary: opts.requestSummary.slice(0, 500),
      tool: opts.tool,
      argumentsHash,
      policyDecision: policy.effect,
      approvalId: approval.approvalId,
      result: "Waiting for human approval",
      outcome: "WAITING_APPROVAL",
      correlationId,
      safeReasoning: `Tool "${opts.tool}" requires human approval under mode ${mode}.`,
    });
    return { status: "WAITING_APPROVAL" as const, approvalId: approval.approvalId, correlationId };
  }

  // Controlled execution: read tools may call intelligence tools; writes stay gated
  let result = "Recorded recommendation / observe outcome (no silent high-impact mutation).";
  if (!isWrite) {
    try {
      const { executeTool } = await import("@/lib/intelligence/tools");
      const toolResult = await executeTool(opts.tool as never, opts.args ?? {}, {
        userId: opts.user._id.toString(),
        organizationId: opts.organizationId,
        role: opts.user.role,
        permissions: opts.user.permissions ?? [],
        user: opts.user,
      });
      result = toolResult.ok ? JSON.stringify(toolResult.data).slice(0, 1500) : toolResult.error ?? "failed";
    } catch {
      result = "Tool execution unavailable; recommendation recorded.";
    }
  }

  await AgentTrace.create({
    traceId: newEnterpriseId("trc"),
    organizationId: new mongoose.Types.ObjectId(opts.organizationId),
    userId: opts.user._id,
    agentId: opts.agentId,
    requestSummary: opts.requestSummary.slice(0, 500),
    intent: opts.tool,
    tool: opts.tool,
    argumentsHash,
    policyDecision: policy.effect,
    result,
    outcome: "SUCCESS",
    correlationId,
    safeReasoning: `Selected "${opts.tool}" because the request matched this agent's registered tools.`,
  });

  return { status: "SUCCESS" as const, result, correlationId, mode };
}
