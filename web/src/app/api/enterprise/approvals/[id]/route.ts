import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { decideApproval } from "@/lib/enterprise/approval-service";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    const { id } = await ctx.params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid decision.", 400, "VALIDATION_ERROR");

    const approval = await decideApproval({
      organizationId,
      approvalId: id,
      user,
      decision: parsed.data.decision,
      note: parsed.data.note,
    });
    return apiSuccess({ approval });
  } catch (error) {
    return handleApiError(error);
  }
}
