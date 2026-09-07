import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { logAuditEvent } from "@/lib/audit/log";
import { POLICY_EFFECTS } from "@/lib/enterprise/constants";
import { EnterprisePolicy, newEnterpriseId } from "@/models/Enterprise";

export async function GET() {
  try {
    await ensureDbReady();
    const { organizationId } = await requireOrgMember(["ADMIN"]);
    const policies = await EnterprisePolicy.find({
      $or: [
        { organizationId: new mongoose.Types.ObjectId(organizationId) },
        { organizationId: null },
      ],
    })
      .sort({ priority: 1 })
      .lean();
    return apiSuccess({ policies });
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  scope: z.string().optional(),
  subject: z.record(z.string(), z.unknown()).optional(),
  action: z.string().min(1).max(120),
  resource: z.record(z.string(), z.unknown()).optional(),
  condition: z.record(z.string(), z.unknown()).optional(),
  effect: z.enum(POLICY_EFFECTS),
  priority: z.number().int().min(1).max(10000).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "DISABLED"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember(["ADMIN"]);
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid policy.", 400, "VALIDATION_ERROR");

    const policy = await EnterprisePolicy.create({
      policyId: newEnterpriseId("pol"),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      scope: parsed.data.scope ?? "ORGANIZATION",
      subject: parsed.data.subject ?? {},
      action: parsed.data.action,
      resource: parsed.data.resource ?? {},
      condition: parsed.data.condition ?? {},
      effect: parsed.data.effect,
      priority: parsed.data.priority ?? 100,
      status: parsed.data.status ?? "ACTIVE",
      createdBy: user._id,
    });

    await logAuditEvent({
      actor: user,
      action: "POLICY_CREATED",
      description: `${user.name} created policy ${policy.policyId}`,
      request,
      targetType: "EnterprisePolicy",
      targetId: policy.policyId,
    });

    return apiSuccess({ policy }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
