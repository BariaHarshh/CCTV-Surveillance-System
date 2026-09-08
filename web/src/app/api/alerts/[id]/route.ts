import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canViewAlerts } from "@/lib/monitoring/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getAlertById } from "@/lib/monitoring/alert-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewAlerts(user)) return apiError("Permission denied.", 403, "FORBIDDEN");

    const { id } = await params;
    const result = await getAlertById(organizationId, id);
    if (!result) return apiError("Alert not found.", 404, "NOT_FOUND");

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
