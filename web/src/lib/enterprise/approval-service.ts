import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { ApprovalRequest, newEnterpriseId } from "@/models/Enterprise";
import { publishEnterpriseEvent } from "./event-bus";
import { logAuditEvent } from "@/lib/audit/log";
import type { IUser } from "@/models/User";

export async function createApprovalRequest(opts: {
  organizationId: string;
  requestedBy: mongoose.Types.ObjectId | null;
  requestedByType: "USER" | "AI" | "AUTOMATION" | "SYSTEM";
  action: string;
  resourceType: string;
  resourceId?: string | null;
  riskLevel?: string;
  reason: string;
  mode?: "ONE" | "TWO" | "ANY" | "ALL";
  requiredApprovers?: mongoose.Types.ObjectId[];
  expiresInMinutes?: number;
  correlationId?: string | null;
  payload?: Record<string, unknown>;
}) {
  await connectDB();
  const approval = await ApprovalRequest.create({
    approvalId: newEnterpriseId("apr"),
    organizationId: new mongoose.Types.ObjectId(opts.organizationId),
    requestedBy: opts.requestedBy,
    requestedByType: opts.requestedByType,
    action: opts.action,
    resourceType: opts.resourceType,
    resourceId: opts.resourceId ?? null,
    riskLevel: opts.riskLevel ?? "MEDIUM",
    reason: opts.reason,
    status: "PENDING",
    mode: opts.mode ?? "ONE",
    requiredApprovers: opts.requiredApprovers ?? [],
    decisions: [],
    expiresAt: new Date(Date.now() + (opts.expiresInMinutes ?? 60 * 24) * 60 * 1000),
    correlationId: opts.correlationId ?? null,
    payload: opts.payload ?? {},
  });

  await publishEnterpriseEvent({
    organizationId: opts.organizationId,
    type: "APPROVAL_REQUESTED",
    resourceType: "APPROVAL",
    resourceId: approval.approvalId,
    correlationId: opts.correlationId ?? null,
    payloadReference: { action: opts.action, riskLevel: opts.riskLevel },
  }).catch(() => undefined);

  return approval;
}

export async function decideApproval(opts: {
  organizationId: string;
  approvalId: string;
  user: IUser;
  decision: "APPROVED" | "REJECTED";
  note?: string;
}) {
  await connectDB();
  const approval = await ApprovalRequest.findOne({
    approvalId: opts.approvalId,
    organizationId: new mongoose.Types.ObjectId(opts.organizationId),
  });
  if (!approval) throw new Error("Approval request not found");
  if (approval.status !== "PENDING") throw new Error("Approval is not pending");
  if (approval.expiresAt < new Date()) {
    approval.status = "EXPIRED";
    await approval.save();
    throw new Error("Approval expired — action will not execute");
  }

  approval.decisions.push({
    approverId: opts.user._id as mongoose.Types.ObjectId,
    decision: opts.decision,
    at: new Date(),
    note: opts.note,
  });

  if (opts.decision === "REJECTED") {
    approval.status = "REJECTED";
  } else {
    const approvedCount = approval.decisions.filter((d) => d.decision === "APPROVED").length;
    if (approval.mode === "ONE" || approval.mode === "ANY") {
      approval.status = "APPROVED";
      approval.approvedAt = new Date();
    } else if (approval.mode === "TWO" && approvedCount >= 2) {
      approval.status = "APPROVED";
      approval.approvedAt = new Date();
    } else if (approval.mode === "ALL") {
      const required = approval.requiredApprovers.length || 1;
      if (approvedCount >= required) {
        approval.status = "APPROVED";
        approval.approvedAt = new Date();
      }
    } else {
      // waiting for more approvals
    }
  }

  await approval.save();

  await logAuditEvent({
    actor: opts.user,
    action: "APPROVAL_DECIDED",
    description: `Approval ${approval.approvalId} → ${approval.status}`,
    metadata: { decision: opts.decision, action: approval.action },
  }).catch(() => undefined);

  await publishEnterpriseEvent({
    organizationId: opts.organizationId,
    type: "APPROVAL_DECIDED",
    resourceType: "APPROVAL",
    resourceId: approval.approvalId,
    payloadReference: { status: approval.status },
  }).catch(() => undefined);

  return approval;
}

export async function expirePendingApprovals() {
  await connectDB();
  await ApprovalRequest.updateMany(
    { status: "PENDING", expiresAt: { $lt: new Date() } },
    { $set: { status: "EXPIRED" } }
  );
}
