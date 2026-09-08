import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { testPolicy } from "@/lib/enterprise/policy-engine";

const schema = z.object({
  action: z.string().min(1),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  subject: z
    .object({
      userId: z.string().optional(),
      role: z.string().optional(),
      agentId: z.string().optional(),
    })
    .optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember(["ADMIN"]);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid policy test.", 400, "VALIDATION_ERROR");

    const decision = await testPolicy({
      subject: {
        userId: parsed.data.subject?.userId ?? user._id.toString(),
        role: parsed.data.subject?.role ?? user.role,
        agentId: parsed.data.subject?.agentId,
        organizationId,
      },
      action: parsed.data.action,
      resourceType: parsed.data.resourceType,
      resourceId: parsed.data.resourceId,
      context: parsed.data.context,
    });

    return apiSuccess({ decision });
  } catch (error) {
    return handleApiError(error);
  }
}
