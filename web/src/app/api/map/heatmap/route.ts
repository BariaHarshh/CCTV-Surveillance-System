import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canViewMap } from "@/lib/map/permissions";
import { getRiskHeatmap } from "@/lib/map/map-service";

export async function GET(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewMap(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const url = new URL(request.url);
    const data = await getRiskHeatmap(organizationId, {
      timeRange: url.searchParams.get("timeRange") || "30D",
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      dayPart: url.searchParams.get("dayPart"),
    });
    return apiSuccess({ heatmap: data });
  } catch (e) {
    return handleApiError(e);
  }
}
