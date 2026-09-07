import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { createApprovalRequest } from "@/lib/enterprise/approval-service";
import { ApprovalRequest } from "@/models/Enterprise";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { organizationId } = await requireOrgMember();
    const pendingOnly = request.nextUrl.searchParams.get("status") === "PENDING";
    const filter: Record<string, unknown> = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
    };
    if (pendingOnly || request.nextUrl.searchParams.get("pending") === "1") {
      filter.status = "PENDING";
    }
    const approvals = await ApprovalRequest.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    return apiSuccess({ approvals });
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  action: z.string().min(1).max(120),
  resourceType: z.string().default("GENERIC"),
  resourceId: z.string().nullable().optional(),
  riskLevel: z.string().optional(),
  reason: z.string().min(1).max(2000),
  mode: z.enum(["ONE", "TWO", "ANY", "ALL"]).optional(),
  expiresInMinutes: z.number().int().positive().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid approval request.", 400, "VALIDATION_ERROR");

    const approval = await createApprovalRequest({
      organizationId,
      requestedBy: user._id as mongoose.Types.ObjectId,
      requestedByType: "USER",
      action: parsed.data.action,
      resourceType: parsed.data.resourceType,
      resourceId: parsed.data.resourceId ?? null,
      riskLevel: parsed.data.riskLevel,
      reason: parsed.data.reason,
      mode: parsed.data.mode,
      expiresInMinutes: parsed.data.expiresInMinutes,
      payload: parsed.data.payload,
    });

    return apiSuccess({ approval }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
