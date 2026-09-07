import crypto from "crypto";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import {
  ApprovalRequest,
  Automation,
  WorkflowRun,
  newEnterpriseId,
} from "@/models/Enterprise";
import { FORBIDDEN_AUTOMATION_ACTIONS } from "./constants";
import { evaluatePolicy } from "./policy-engine";
import { createApprovalRequest } from "./approval-service";
import { logAuditEvent } from "@/lib/audit/log";

type Step = {
  at: string;
  label: string;
  status: "PASS" | "FAIL" | "SKIP" | "WAITING" | "WOULD";
  detail?: string;
};

export function evaluateAutomationConditions(
  conditions: Array<Record<string, unknown>>,
  context: Record<string, unknown>
): { pass: boolean; detail: string } {
  if (!conditions.length) return { pass: true, detail: "No conditions" };
  for (const c of conditions) {
    const field = String(c.field ?? "");
    const op = String(c.op ?? "eq");
    const expected = c.value;
    const actual = context[field];
    let ok = true;
    if (op === "eq") ok = actual === expected || String(actual) === String(expected);
    else if (op === "neq") ok = String(actual) !== String(expected);
    else if (op === "gte") ok = Number(actual) >= Number(expected);
    else if (op === "lte") ok = Number(actual) <= Number(expected);
    else if (op === "in") ok = Array.isArray(expected) && expected.map(String).includes(String(actual));
    if (!ok) return { pass: false, detail: `Condition failed: ${field} ${op} ${JSON.stringify(expected)}` };
  }
  return { pass: true, detail: "All conditions passed" };
}

export function isForbiddenAutomationAction(actionType: string) {
  return FORBIDDEN_AUTOMATION_ACTIONS.includes(actionType as (typeof FORBIDDEN_AUTOMATION_ACTIONS)[number]);
}

function isForbiddenAction(actionType: string) {
  return isForbiddenAutomationAction(actionType);
}

export async function processEventForAutomations(opts: {
  organizationId: string;
  eventType: string;
  eventId: string;
  correlationId: string;
  resourceId?: string | null;
  dryRun?: boolean;
  simulateContext?: Record<string, unknown>;
}) {
  await connectDB();
  const automations = await Automation.find({
    organizationId: new mongoose.Types.ObjectId(opts.organizationId),
    status: "ACTIVE",
  });

  const results = [];
  for (const auto of automations) {
    const triggerType = String((auto.trigger as { type?: string })?.type ?? "");
    const triggerEvent = String((auto.trigger as { event?: string })?.event ?? "");
    const matches =
      !triggerEvent ||
      triggerEvent === opts.eventType ||
      (triggerType === "SCHEDULE" && opts.eventType.startsWith("SCHEDULE_"));
    if (!matches && triggerEvent) continue;

    const run = await executeAutomationRun({
      automation: auto,
      organizationId: opts.organizationId,
      correlationId: opts.correlationId,
      dryRun: Boolean(opts.dryRun),
      context: {
        eventType: opts.eventType,
        eventId: opts.eventId,
        resourceId: opts.resourceId ?? null,
        severity: opts.simulateContext?.severity ?? "HIGH",
        ...(opts.simulateContext ?? {}),
      },
    });
    results.push(run);
  }
  return results;
}

export async function executeAutomationRun(opts: {
  automation: {
    automationId: string;
    name: string;
    conditions: Array<Record<string, unknown>>;
    actions: Array<Record<string, unknown>>;
    organizationId?: mongoose.Types.ObjectId;
  };
  organizationId: string;
  correlationId: string;
  dryRun: boolean;
  context: Record<string, unknown>;
  actor?: { _id: mongoose.Types.ObjectId; role: string; name?: string } | null;
}) {
  await connectDB();
  const steps: Step[] = [];
  const startedAt = new Date();
  steps.push({ at: startedAt.toISOString(), label: "Trigger detected", status: "PASS" });

  const cond = evaluateAutomationConditions(opts.automation.conditions ?? [], opts.context);
  steps.push({
    at: new Date().toISOString(),
    label: "Condition evaluated",
    status: cond.pass ? "PASS" : "FAIL",
    detail: cond.detail,
  });

  let status: string = cond.pass ? "RUNNING" : "COMPLETED";
  let error: string | null = null;
  const executedActions: string[] = [];

  if (cond.pass) {
    for (const action of opts.automation.actions ?? []) {
      const type = String(action.type ?? action.action ?? "AUDIT");
      if (isForbiddenAction(type)) {
        steps.push({
          at: new Date().toISOString(),
          label: `Blocked forbidden action ${type}`,
          status: "FAIL",
          detail: "Automation safety policy forbids this action.",
        });
        status = "FAILED";
        error = `Forbidden action: ${type}`;
        break;
      }

      const policy = await evaluatePolicy({
        subject: {
          role: opts.actor?.role ?? "AUTOMATION",
          organizationId: opts.organizationId,
          agentId: "workflow-agent",
        },
        action: type,
        resourceType: "AUTOMATION",
        resourceId: opts.automation.automationId,
      });

      if (policy.effect === "DENY") {
        steps.push({
          at: new Date().toISOString(),
          label: `Policy DENY: ${type}`,
          status: "FAIL",
          detail: policy.reason,
        });
        status = "FAILED";
        error = policy.reason;
        break;
      }

      if (policy.effect === "REQUIRE_APPROVAL") {
        if (opts.dryRun) {
          steps.push({
            at: new Date().toISOString(),
            label: `Approval REQUIRED for ${type}`,
            status: "WOULD",
            detail: policy.reason,
          });
          continue;
        }
        const approval = await createApprovalRequest({
          organizationId: opts.organizationId,
          requestedBy: opts.actor?._id ?? null,
          requestedByType: "AUTOMATION",
          action: type,
          resourceType: "AUTOMATION_ACTION",
          resourceId: opts.automation.automationId,
          riskLevel: "HIGH",
          reason: `Automation "${opts.automation.name}" requires approval for ${type}`,
          correlationId: opts.correlationId,
          payload: { action, context: opts.context },
        });
        steps.push({
          at: new Date().toISOString(),
          label: "Approval requested",
          status: "WAITING",
          detail: approval.approvalId,
        });
        status = "WAITING_APPROVAL";
        executedActions.push(`APPROVAL:${approval.approvalId}`);
        break;
      }

      if (opts.dryRun) {
        steps.push({
          at: new Date().toISOString(),
          label: `Would execute ${type}`,
          status: "WOULD",
          detail: JSON.stringify(action).slice(0, 200),
        });
        executedActions.push(`WOULD:${type}`);
        continue;
      }

      // Safe side-effects: audit + structured step only (no mass delete / hardware)
      steps.push({
        at: new Date().toISOString(),
        label: `Executed ${type}`,
        status: "PASS",
        detail: "Recorded via workflow engine (controlled).",
      });
      executedActions.push(type);
    }
    if (status === "RUNNING") status = "COMPLETED";
  }

  const run = await WorkflowRun.create({
    runId: newEnterpriseId("run"),
    organizationId: new mongoose.Types.ObjectId(opts.organizationId),
    automationId: opts.automation.automationId,
    status,
    trigger: opts.context,
    steps,
    dryRun: opts.dryRun,
    error,
    correlationId: opts.correlationId,
    startedAt,
    completedAt: status === "WAITING_APPROVAL" ? null : new Date(),
  });

  if (!opts.dryRun) {
    await logAuditEvent({
      actor: (opts.actor as never) ?? null,
      action: "AUTOMATION_RUN",
      description: `Automation ${opts.automation.automationId} run ${run.runId} → ${status}`,
      metadata: { executedActions, dryRun: opts.dryRun, correlationId: opts.correlationId },
    }).catch(() => undefined);
  }

  return {
    runId: run.runId,
    status,
    steps,
    executedActions,
    error,
    dryRun: opts.dryRun,
  };
}

export async function simulateAutomation(
  organizationId: string,
  automationId: string,
  context: Record<string, unknown>
) {
  await connectDB();
  const automation = await Automation.findOne({
    automationId,
    organizationId: new mongoose.Types.ObjectId(organizationId),
  });
  if (!automation) throw new Error("Automation not found");
  return executeAutomationRun({
    automation,
    organizationId,
    correlationId: crypto.randomUUID(),
    dryRun: true,
    context,
  });
}
