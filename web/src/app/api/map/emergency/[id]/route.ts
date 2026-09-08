import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canViewMap } from "@/lib/map/permissions";
import { getEmergencyMapData } from "@/lib/map/map-service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewMap(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const { id } = await context.params;
    const data = await getEmergencyMapData(organizationId, id);
    if (!data) return apiError("Emergency not found", 404, "NOT_FOUND");
    return apiSuccess({ emergencyMap: data });
  } catch (e) {
    return handleApiError(e);
  }
}
