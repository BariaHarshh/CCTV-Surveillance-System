import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canViewMap } from "@/lib/map/permissions";
import { getBuildingMapDetail } from "@/lib/map/map-service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ buildingId: string }> }
) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewMap(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const { buildingId } = await context.params;
    const data = await getBuildingMapDetail(organizationId, buildingId);
    if (!data) return apiError("Building not found", 404, "NOT_FOUND");
    return apiSuccess({ building: data });
  } catch (e) {
    return handleApiError(e);
  }
}
