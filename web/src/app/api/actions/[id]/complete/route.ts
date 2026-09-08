import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canManageActions } from "@/lib/analytics/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { completeAction } from "@/lib/analytics/action-service";
import { logAuditEvent } from "@/lib/audit/log";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canManageActions(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const action = await completeAction(organizationId, id);
    if (!action) return apiError("Action not found.", 404, "NOT_FOUND");
    await logAuditEvent({
      actor: user,
      action: "CORRECTIVE_ACTION_COMPLETED",
      description: `${user.name} completed corrective action ${action.actionId}`,
      request,
      targetType: "CorrectiveAction",
      targetId: id,
    });
    return apiSuccess({ action });
  } catch (error) {
    return handleApiError(error);
  }
}
