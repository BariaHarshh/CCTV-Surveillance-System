import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canViewMap } from "@/lib/map/permissions";
import { getMapBootstrap } from "@/lib/map/map-service";

export async function GET() {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewMap(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const data = await getMapBootstrap(organizationId, user);
    return apiSuccess({ bootstrap: data });
  } catch (e) {
    return handleApiError(e);
  }
}
