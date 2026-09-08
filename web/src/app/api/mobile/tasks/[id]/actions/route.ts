import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canViewFieldOps } from "@/lib/mobile/permissions";
import { applyTaskAction, getTaskDetail } from "@/lib/mobile/field-service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewFieldOps(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const { id } = await context.params;
    const task = await getTaskDetail(organizationId, id);
    if (!task) return apiError("Not found", 404, "NOT_FOUND");
    return apiSuccess({ task });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewFieldOps(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const { id } = await context.params;
    const body = await request.json();
    const action = String(body.action || "");
    if (["complete", "reject"].includes(action) && !body.confirmed) {
      return apiError("Confirmation required for this action", 400, "CONFIRMATION_REQUIRED");
    }
    const result = await applyTaskAction(organizationId, user, id, action, body);
    if ("error" in result) {
      const code = result.error === "NOT_FOUND" ? 404 : 400;
      return apiError(String(result.error), code, result.error);
    }
    return apiSuccess(result);
  } catch (e) {
    return handleApiError(e);
  }
}
