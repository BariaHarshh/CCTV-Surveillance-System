import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { EnterprisePolicy } from "@/models/Enterprise";
import type { PolicyEffect } from "./constants";

export type PolicySubject = {
  userId?: string;
  role?: string;
  agentId?: string;
  organizationId?: string | null;
};

export type PolicyEvalInput = {
  subject: PolicySubject;
  action: string;
  resourceType?: string;
  resourceId?: string;
  context?: Record<string, unknown>;
};

export type PolicyDecision = {
  effect: PolicyEffect;
  policyId: string | null;
  policyName: string | null;
  reason: string;
};

function matchesSubject(policySubject: Record<string, unknown>, subject: PolicySubject) {
  if (policySubject.role && subject.role && String(policySubject.role) !== subject.role) return false;
  if (policySubject.agentId && subject.agentId && String(policySubject.agentId) !== subject.agentId) return false;
  return true;
}

/**
 * Pure priority resolver — DENY always beats ALLOW (and other effects).
 * Priority: Explicit DENY → REQUIRE_APPROVAL → Explicit ALLOW → AUDIT_ONLY → default.
 */
export function resolvePolicyEffects(
  applicable: Array<{ effect: string; policyId: string; name: string }>,
  action: string
): PolicyDecision {
  const deny = applicable.find((p) => p.effect === "DENY");
  if (deny) {
    return {
      effect: "DENY",
      policyId: deny.policyId,
      policyName: deny.name,
      reason: `Denied by policy "${deny.name}".`,
    };
  }

  const approval = applicable.find((p) => p.effect === "REQUIRE_APPROVAL");
  if (approval) {
    return {
      effect: "REQUIRE_APPROVAL",
      policyId: approval.policyId,
      policyName: approval.name,
      reason: `Approval required by policy "${approval.name}".`,
    };
  }

  const allow = applicable.find((p) => p.effect === "ALLOW");
  if (allow) {
    return {
      effect: "ALLOW",
      policyId: allow.policyId,
      policyName: allow.name,
      reason: `Allowed by policy "${allow.name}".`,
    };
  }

  const audit = applicable.find((p) => p.effect === "AUDIT_ONLY");
  if (audit) {
    return {
      effect: "AUDIT_ONLY",
      policyId: audit.policyId,
      policyName: audit.name,
      reason: `Audit-only policy "${audit.name}" — no hard block.`,
    };
  }

  const privileged = /DELETE|BULK|BILLING|PERMISSION|EXTERNAL|MASS|DISABLE_ALL/i.test(action);
  if (privileged) {
    return {
      effect: "REQUIRE_APPROVAL",
      policyId: null,
      policyName: null,
      reason: "High-impact action requires approval by default.",
    };
  }

  return {
    effect: "ALLOW",
    policyId: null,
    policyName: null,
    reason: "No conflicting policy; action permitted under default enterprise rules.",
  };
}

/**
 * Deterministic policy engine — AI never makes the final authorization decision.
 */
export async function evaluatePolicy(input: PolicyEvalInput): Promise<PolicyDecision> {
  await connectDB();
  const orgFilter =
    input.subject.organizationId != null
      ? {
          $or: [
            { organizationId: new mongoose.Types.ObjectId(input.subject.organizationId) },
            { organizationId: null },
          ],
        }
      : { organizationId: null };

  const policies = await EnterprisePolicy.find({
    ...orgFilter,
    status: "ACTIVE",
    action: { $in: [input.action, "*"] },
  })
    .sort({ priority: 1 })
    .lean();

  const applicable = policies
    .filter((p) => matchesSubject(p.subject ?? {}, input.subject))
    .map((p) => ({ effect: p.effect, policyId: p.policyId, name: p.name }));

  return resolvePolicyEffects(applicable, input.action);
}

export async function testPolicy(input: PolicyEvalInput) {
  return evaluatePolicy(input);
}
