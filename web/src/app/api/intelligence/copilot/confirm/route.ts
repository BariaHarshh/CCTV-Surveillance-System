import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { confirmPendingAction } from "@/lib/intelligence/orchestrator";

const schema = z.object({
  actionId: z.string().min(1),
  confirm: z.boolean(),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember(["ADMIN", "STAFF"]);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid request body.", 400, "VALIDATION_ERROR");

    const result = await confirmPendingAction({
      organizationId,
      user,
      actionId: parsed.data.actionId,
      confirm: parsed.data.confirm,
    });

    return apiSuccess({ result });
  } catch (error) {
    return handleApiError(error);
  }
}
