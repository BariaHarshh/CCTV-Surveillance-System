import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canViewMap } from "@/lib/map/permissions";
import { getMapActivity, searchMap } from "@/lib/map/map-service";

export async function GET(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewMap(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const url = new URL(request.url);
    const q = url.searchParams.get("q");
    if (q) {
      const data = await searchMap(organizationId, user, q);
      return apiSuccess(data);
    }
    const data = await getMapActivity(organizationId);
    return apiSuccess({ activity: data });
  } catch (e) {
    return handleApiError(e);
  }
}
