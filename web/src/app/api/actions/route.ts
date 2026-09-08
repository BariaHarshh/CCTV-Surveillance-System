import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canManageActions, canViewActions } from "@/lib/analytics/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { createAction, listActions } from "@/lib/analytics/action-service";
import { logAuditEvent } from "@/lib/audit/log";
import { ACTION_PRIORITIES } from "@/lib/analytics/constants";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewActions(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const status = request.nextUrl.searchParams.get("status") ?? undefined;
    const result = await listActions(organizationId, status);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  priority: z.enum(ACTION_PRIORITIES).optional(),
  sourceType: z.string().optional(),
  sourceId: z.string().nullable().optional(),
  dueAt: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canManageActions(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid action.", 400, "VALIDATION_ERROR");
    const action = await createAction(organizationId, parsed.data, {
      id: user._id.toString(),
      name: user.name,
    });
    await logAuditEvent({
      actor: user,
      action: "CORRECTIVE_ACTION_CREATED",
      description: `${user.name} created corrective action ${action.actionId}`,
      request,
      targetType: "CorrectiveAction",
      targetId: action.id,
    });
    return apiSuccess({ action }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
