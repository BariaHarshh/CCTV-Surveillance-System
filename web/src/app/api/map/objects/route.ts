import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canViewMap } from "@/lib/map/permissions";
import { getViewportObjects } from "@/lib/map/map-service";

export async function GET(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewMap(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const url = new URL(request.url);
    const layers = url.searchParams.get("layers")?.split(",").filter(Boolean);
    const data = await getViewportObjects(organizationId, user, {
      campusId: url.searchParams.get("campusId"),
      bounds: url.searchParams.get("bounds"),
      zoom: Number(url.searchParams.get("zoom") || 15),
      layers,
      severity: url.searchParams.get("severity"),
      cameraStatus: url.searchParams.get("cameraStatus"),
      timeRange: url.searchParams.get("timeRange") || "7D",
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      q: url.searchParams.get("q"),
    });
    return apiSuccess({ objects: data });
  } catch (e) {
    return handleApiError(e);
  }
}
