import crypto from "crypto";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import {
  AIConversation,
  AIMessage,
  AIUnansweredQuestion,
  AIUsageRecord,
  OrgAIPrivacySettings,
  PendingAIAction,
} from "@/models/Intelligence";
import { FeatureFlag } from "@/models/Platform";
import { getOrCreateSubscription } from "@/lib/platform/billing-service";
import { DEFAULT_AI_REQUEST_LIMITS } from "./constants";
import { getAIStatus, getConfiguredProvider } from "./providers";
import { detectIntent, executeTool, requiresConfirmation, toolAllowed } from "./tools";
import { searchKnowledge } from "./rag";
import {
  buildCameraMaintenance,
  buildDailyBriefing,
  buildPredictiveRisk,
  buildRecommendations,
} from "./briefing";
import {
  SYSTEM_GUARDRAILS,
  buildSeparatedPromptParts,
  redactSensitive,
  sanitizeUserInput,
} from "./safety";
import type { AIContextSnapshot, AIResponseBlock, AISourceRef, OrchestratorResult, ToolExecutionContext } from "./types";
import type { AIToolName, ConfidenceLevel } from "./constants";
import { logAuditEvent } from "@/lib/audit/log";
import type { IUser } from "@/models/User";

async function isFlagEnabled(key: string, organizationId: string | null) {
  const flag = await FeatureFlag.findOne({ key }).lean();
  if (!flag) return true; // default on when unset
  if (!flag.enabled) return false;
  if (organizationId && flag.organizationIds?.length) {
    return flag.organizationIds.some((id) => String(id) === organizationId);
  }
  return true;
}

export async function getOrCreatePrivacy(organizationId: string) {
  await connectDB();
  let doc = await OrgAIPrivacySettings.findOne({ organizationId: new mongoose.Types.ObjectId(organizationId) });
  if (!doc) {
    doc = await OrgAIPrivacySettings.create({ organizationId: new mongoose.Types.ObjectId(organizationId) });
  }
  return doc;
}

export async function assertAIAllowed(organizationId: string, user: IUser) {
  const { hasFeature } = await import("@/lib/platform/billing-service");
  const advanced = await hasFeature(organizationId, "advanced_ai");
  const basic = await hasFeature(organizationId, "ai_detection");
  if (!advanced && !basic) {
    const { FeatureGateError } = await import("@/lib/platform/billing-service");
    throw new FeatureGateError("AI features require ai_detection or advanced_ai on the current plan.");
  }
  const privacy = await getOrCreatePrivacy(organizationId);
  if (!privacy.aiEnabled || !privacy.copilotEnabled) {
    throw new Error("AI Copilot is disabled for this organization.");
  }
  if (!(await isFlagEnabled("ai-copilot", organizationId))) {
    throw new Error("AI Copilot feature flag is disabled.");
  }
  const sub = await getOrCreateSubscription(organizationId);
  const limit = DEFAULT_AI_REQUEST_LIMITS[sub.planId] ?? 500;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const used = await AIUsageRecord.countDocuments({
    organizationId: new mongoose.Types.ObjectId(organizationId),
    createdAt: { $gte: monthStart },
  });
  if (used >= limit) {
    const { PlanLimitError } = await import("@/lib/platform/billing-service");
    throw new PlanLimitError(`AI request limit reached for plan ${sub.planId} (${used}/${limit}).`);
  }
  return { privacy, limit, used, user, advanced };
}

export async function listConversations(organizationId: string, userId: string) {
  await connectDB();
  return AIConversation.find({
    organizationId: new mongoose.Types.ObjectId(organizationId),
    userId: new mongoose.Types.ObjectId(userId),
    status: { $ne: "DELETED" },
  })
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();
}

export async function createConversation(organizationId: string, userId: string, title = "New chat") {
  await connectDB();
  return AIConversation.create({
    conversationId: `conv_${crypto.randomBytes(8).toString("hex")}`,
    organizationId: new mongoose.Types.ObjectId(organizationId),
    userId: new mongoose.Types.ObjectId(userId),
    title,
    status: "ACTIVE",
  });
}

export async function getMessages(organizationId: string, conversationId: string, userId: string) {
  await connectDB();
  const conv = await AIConversation.findOne({
    conversationId,
    organizationId: new mongoose.Types.ObjectId(organizationId),
    userId: new mongoose.Types.ObjectId(userId),
    status: { $ne: "DELETED" },
  });
  if (!conv) throw new Error("Conversation not found");
  return AIMessage.find({
    conversationId,
    organizationId: new mongoose.Types.ObjectId(organizationId),
  })
    .sort({ createdAt: 1 })
    .limit(200)
    .lean();
}

function buildBlocksFromTools(
  toolName: string,
  data: Record<string, unknown>
): { content: string; blocks: AIResponseBlock[]; sources: AISourceRef[]; confidence: ConfidenceLevel } {
  const blocks: AIResponseBlock[] = [];
  const sources: AISourceRef[] = [];
  let content = "";
  let confidence: ConfidenceLevel = "HIGH";

  if (toolName === "getCampusRisk" && data.highest) {
    const h = data.highest as Record<string, unknown>;
    content = `Highest Risk Campus\n\nCampus: ${h.name}\nRisk Score: ${h.riskScore} / 100`;
    blocks.push({
      type: "card",
      title: "Highest Risk Campus",
      items: [
        { label: "Campus", value: String(h.name) },
        { label: "Risk Score", value: `${h.riskScore} / 100` },
        { label: "Open incidents", value: Number(h.openIncidents) },
        { label: "High alerts", value: Number(h.highAlerts) },
        { label: "Offline cameras", value: Number(h.offlineCameras) },
      ],
    });
    blocks.push({
      type: "links",
      links: [
        { label: "View Campuses", href: "/admin/campus" },
        { label: "View Incidents", href: "/admin/incidents" },
        { label: "View Risk Analysis", href: "/ai/predictive-risk" },
      ],
    });
    sources.push({ type: "campus", id: String(h.campusId), title: String(h.name), href: "/admin/campus" });
  } else if (toolName === "getDashboardSummary") {
    content = `Dashboard summary (live data)\nOpen incidents: ${data.openIncidents}\nCritical alerts: ${data.criticalAlerts}\nOffline cameras: ${data.offlineCameras}\nActive emergencies: ${data.activeEmergencies}`;
    blocks.push({
      type: "stats",
      items: [
        { label: "Open incidents", value: Number(data.openIncidents), href: "/admin/incidents" },
        { label: "Critical alerts", value: Number(data.criticalAlerts), href: "/admin/alerts" },
        { label: "Offline cameras", value: Number(data.offlineCameras), href: "/admin/cameras" },
        { label: "Active emergencies", value: Number(data.activeEmergencies), href: "/admin/emergency" },
      ],
    });
  } else if (toolName === "getIncidents" || toolName === "getAlerts" || toolName === "getOfflineCameras") {
    const key = toolName === "getIncidents" ? "incidents" : toolName === "getAlerts" ? "alerts" : "cameras";
    const rows = (data[key] as Array<Record<string, unknown>>) ?? [];
    content = `Found ${data.count ?? rows.length} ${key}.`;
    if (rows.length === 0) {
      content = `I couldn't find reliable data matching that request for ${key}.`;
      confidence = "HIGH";
    } else {
      blocks.push({
        type: "table",
        columns: Object.keys(rows[0]).filter((k) => k !== "id"),
        rows: rows.slice(0, 15).map((r) => {
          const out: Record<string, string | number | null> = {};
          for (const [k, v] of Object.entries(r)) {
            if (k === "id") continue;
            out[k] = v == null ? null : typeof v === "number" ? v : String(v);
          }
          return out;
        }),
      });
    }
  } else {
    content = JSON.stringify(data, null, 2).slice(0, 2000);
    blocks.push({ type: "text", content });
  }

  sources.push({ type: "tool", id: toolName, title: toolName });
  return { content, blocks, sources, confidence };
}

export async function runOrchestrator(opts: {
  organizationId: string;
  user: IUser;
  conversationId?: string;
  message: string;
  context?: Partial<AIContextSnapshot>;
}): Promise<OrchestratorResult> {
  const started = Date.now();
  await connectDB();
  const { privacy } = await assertAIAllowed(opts.organizationId, opts.user);
  const userId = opts.user._id.toString();

  let conversationId = opts.conversationId;
  if (!conversationId) {
    const conv = await createConversation(opts.organizationId, userId, opts.message.slice(0, 48) || "New chat");
    conversationId = conv.conversationId;
  } else {
    const conv = await AIConversation.findOne({
      conversationId,
      organizationId: new mongoose.Types.ObjectId(opts.organizationId),
      userId: new mongoose.Types.ObjectId(userId),
    });
    if (!conv) throw new Error("Conversation not found");
  }

  const { clean, injectionSuspected } = sanitizeUserInput(opts.message);
  const redacted = redactSensitive(clean, privacy.redactionEnabled);

  await AIMessage.create({
    messageId: `msg_${crypto.randomBytes(8).toString("hex")}`,
    conversationId,
    organizationId: new mongoose.Types.ObjectId(opts.organizationId),
    userId: new mongoose.Types.ObjectId(userId),
    role: "user",
    content: redacted,
  });

  const ctx: ToolExecutionContext = {
    userId,
    organizationId: opts.organizationId,
    role: opts.user.role,
    permissions: opts.user.permissions ?? [],
    user: opts.user,
  };

  const intent = detectIntent(clean);
  const toolResults: Array<{ tool: string; data: Record<string, unknown> }> = [];
  const sources: AISourceRef[] = [];
  const blocks: AIResponseBlock[] = [];
  let contentParts: string[] = [];
  let confidence: ConfidenceLevel = "HIGH";
  let pendingAction = null as OrchestratorResult["pendingAction"];
  const toolsUsed: string[] = [];

  if (injectionSuspected) {
    contentParts.push(
      "Warning: The message looked like it tried to override system instructions. System rules were not changed; answering with verified tools only."
    );
  }

  for (const tool of intent.tools) {
    if (!toolAllowed(ctx, tool)) continue;
    toolsUsed.push(tool);

    if (requiresConfirmation(tool)) {
      const actionId = `act_${crypto.randomBytes(8).toString("hex")}`;
      await PendingAIAction.create({
        actionId,
        organizationId: new mongoose.Types.ObjectId(opts.organizationId),
        userId: new mongoose.Types.ObjectId(userId),
        conversationId,
        tool,
        args: intent.args,
        risk: "HIGH",
        summary: `Ready to run ${tool}. Confirm to execute via existing platform APIs.`,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });
      pendingAction = {
        actionId,
        tool,
        args: intent.args,
        risk: "HIGH",
        summary: `I am ready to execute ${tool}. This requires your confirmation.`,
      };
      contentParts.push(pendingAction.summary);
      continue;
    }

    if (tool === "searchKnowledge") {
      const hits = await searchKnowledge(opts.organizationId, clean, 4);
      toolResults.push({ tool, data: { hits } });
      if (hits.length === 0) {
        await AIUnansweredQuestion.create({
          organizationId: new mongoose.Types.ObjectId(opts.organizationId),
          userId: new mongoose.Types.ObjectId(userId),
          question: clean.slice(0, 500),
          status: "OPEN",
        });
        contentParts.push("I couldn't find reliable published knowledge for that request.");
        confidence = "LOW";
      } else {
        contentParts.push("Relevant knowledge (published, organization-scoped):");
        for (const h of hits) {
          contentParts.push(`• ${h.title} — ${h.section} (${h.version})`);
          sources.push({
            type: "document",
            id: h.documentId,
            title: h.title,
            section: h.section,
            version: h.version,
            href: h.href,
          });
        }
        blocks.push({
          type: "recommendations",
          title: "Sources",
          items: hits.map((h) => ({ label: h.title, value: `${h.section} · ${h.version}` })),
        });
      }
      continue;
    }

    if (tool === "getPredictiveRisk") {
      const risk = await buildPredictiveRisk(opts.organizationId);
      toolResults.push({ tool, data: risk as unknown as Record<string, unknown> });
      contentParts.push(
        `Current risk score: ${risk.currentRisk}/100 (${risk.trend}). Confidence: ${risk.confidence}.\n${risk.disclaimer}`
      );
      blocks.push({
        type: "stats",
        items: [
          { label: "Current risk", value: risk.currentRisk },
          { label: "Trend", value: risk.trend },
          { label: "Confidence", value: risk.confidence },
        ],
      });
      confidence = risk.confidence;
      continue;
    }

    if (tool === "getRecommendations") {
      const recs = await buildRecommendations(opts.organizationId);
      toolResults.push({ tool, data: recs as unknown as Record<string, unknown> });
      blocks.push({
        type: "recommendations",
        items: recs.recommendations.map((r) => ({
          label: r.priority,
          value: `${r.reason} Evidence: ${r.evidence}. Action: ${r.suggestedAction}`,
          severity: r.priority,
        })),
      });
      contentParts.push("Recommendations derived from live organization metrics:");
      continue;
    }

    if (tool === "getCameraHealth") {
      const health = await buildCameraMaintenance(opts.organizationId);
      const attention = health.filter((h) => h.health !== "Healthy").slice(0, 15);
      toolResults.push({ tool, data: { cameras: attention } });
      const built = buildBlocksFromTools("getOfflineCameras", {
        cameras: attention.map((c) => ({ name: c.name, health: c.health, reason: c.reason, status: c.status })),
        count: attention.length,
      });
      contentParts.push(built.content);
      blocks.push(...built.blocks);
      sources.push(...built.sources);
      continue;
    }

    if (tool === "getDashboardSummary" && /briefing|morning|daily/.test(clean.toLowerCase())) {
      const brief = await buildDailyBriefing(opts.organizationId);
      toolResults.push({ tool, data: brief as unknown as Record<string, unknown> });
      contentParts.push(
        `${brief.greeting}\nOverall Safety: ${brief.overallSafety}/100\nCritical Alerts: ${brief.criticalAlerts}\nOpen Incidents: ${brief.openIncidents}\nOffline Cameras: ${brief.offlineCameras}\nRecommended Attention: ${brief.recommendedAttention}`
      );
      continue;
    }

    const result = await executeTool(tool, intent.args, ctx);
    if (!result.ok) {
      contentParts.push(`Tool ${tool} denied or failed: ${result.error}`);
      continue;
    }
    toolResults.push({ tool, data: result.data });
    const built = buildBlocksFromTools(tool, result.data);
    contentParts.push(built.content);
    blocks.push(...built.blocks);
    sources.push(...built.sources);
    confidence = built.confidence;
  }

  const status = getAIStatus();
  let mode: OrchestratorResult["mode"] = status.available && privacy.allowExternalProviders ? "llm" : "tools";
  let model = "tools-orchestrator";
  let provider = "NONE";
  let warning: string | null = null;

  if (mode === "llm") {
    try {
      const parts = buildSeparatedPromptParts({
        system: SYSTEM_GUARDRAILS,
        user: redacted,
        documents: sources
          .filter((s) => s.type === "document")
          .map((s) => `${s.title} ${s.section ?? ""}`)
          .join("\n"),
        toolResults: JSON.stringify(toolResults).slice(0, 6000),
      });
      const p = getConfiguredProvider();
      const completion = await p.complete({
        system: parts.system,
        messages: [
          {
            role: "user",
            content: [parts.user, parts.documents, parts.toolResults].filter(Boolean).join("\n\n"),
          },
        ],
      });
      contentParts = [completion.content || contentParts.join("\n\n")];
      model = completion.model;
      provider = completion.provider;
      await AIUsageRecord.create({
        organizationId: new mongoose.Types.ObjectId(opts.organizationId),
        userId: new mongoose.Types.ObjectId(userId),
        provider,
        model,
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
        latencyMs: completion.latencyMs,
        success: true,
        toolsUsed,
        estimatedCostUsd: (completion.inputTokens * 0.00000015 + completion.outputTokens * 0.0000006),
      });
    } catch (e) {
      mode = "tools";
      warning = "AI service is temporarily unavailable. Showing verified tool results instead.";
      await AIUsageRecord.create({
        organizationId: new mongoose.Types.ObjectId(opts.organizationId),
        userId: new mongoose.Types.ObjectId(userId),
        provider: "NONE",
        model: "tools-fallback",
        success: false,
        error: e instanceof Error ? e.message : "provider_error",
        toolsUsed,
        latencyMs: Date.now() - started,
      });
    }
  } else {
    warning = status.available
      ? "External AI is configured but disabled by organization privacy settings — using data tools only."
      : status.message;
    await AIUsageRecord.create({
      organizationId: new mongoose.Types.ObjectId(opts.organizationId),
      userId: new mongoose.Types.ObjectId(userId),
      provider: "NONE",
      model: "tools-orchestrator",
      success: true,
      toolsUsed,
      latencyMs: Date.now() - started,
    });
  }

  if (contentParts.length === 0) {
    contentParts.push("I couldn't find reliable data for that request.");
    confidence = "LOW";
  }

  const content = contentParts.join("\n\n");
  const messageId = `msg_${crypto.randomBytes(8).toString("hex")}`;
  await AIMessage.create({
    messageId,
    conversationId,
    organizationId: new mongoose.Types.ObjectId(opts.organizationId),
    userId: new mongoose.Types.ObjectId(userId),
    role: pendingAction ? "action_confirm" : "assistant",
    content,
    blocks,
    sources,
    confidence,
    toolsUsed,
    model,
    provider,
    pendingAction,
  });

  await AIConversation.updateOne(
    { conversationId },
    { $set: { updatedAt: new Date(), title: clean.slice(0, 48) || "Chat" } }
  );

  await logAuditEvent({
    actor: opts.user,
    action: "AI_COPILOT_QUERY",
    description: `AI orchestrator tools=[${toolsUsed.join(",")}] mode=${mode}`,
    targetType: "AIConversation",
    targetLabel: conversationId,
    metadata: { toolsUsed, mode, model },
  }).catch(() => undefined);

  return {
    conversationId,
    messageId,
    role: pendingAction ? "action_confirm" : "assistant",
    content,
    blocks,
    sources,
    confidence,
    pendingAction,
    model,
    provider,
    latencyMs: Date.now() - started,
    toolsUsed,
    mode,
    warning,
  };
}

export async function confirmPendingAction(opts: {
  organizationId: string;
  user: IUser;
  actionId: string;
  confirm: boolean;
}) {
  await connectDB();
  const action = await PendingAIAction.findOne({
    actionId: opts.actionId,
    organizationId: new mongoose.Types.ObjectId(opts.organizationId),
    userId: opts.user._id,
    status: "PENDING",
  });
  if (!action) throw new Error("Pending action not found");
  if (action.expiresAt < new Date()) {
    action.status = "EXPIRED";
    await action.save();
    throw new Error("Action expired");
  }
  if (!opts.confirm) {
    action.status = "CANCELLED";
    await action.save();
    return { status: "CANCELLED" as const };
  }
  // High-impact actions: record confirmation; actual entity creation uses existing APIs via UI deep-links.
  action.status = "CONFIRMED";
  await action.save();
  await logAuditEvent({
    actor: opts.user,
    action: "AI_ACTION_CONFIRMED",
    description: `Confirmed AI action ${action.tool}`,
    metadata: { tool: action.tool, args: action.args },
  }).catch(() => undefined);
  return {
    status: "CONFIRMED" as const,
    tool: action.tool,
    next: action.tool === "generateReport" ? "/admin/reports" : action.tool === "createIncident" ? "/admin/incidents" : "/admin/actions",
    note: "Confirmed. Complete the action in the linked platform screen — AI does not silently mutate production records.",
  };
}
