import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canViewVideo } from "@/lib/video/permissions";
import { getVideoDashboard, listVideoCameras } from "@/lib/video/video-service";

export async function GET(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewVideo(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const url = new URL(request.url);
    if (url.searchParams.get("cameras") === "1") {
      const cameras = await listVideoCameras(organizationId, {
        q: url.searchParams.get("q") ?? undefined,
        status: url.searchParams.get("status") ?? undefined,
        buildingId: url.searchParams.get("buildingId") ?? undefined,
        floor: url.searchParams.get("floor") ?? undefined,
        type: url.searchParams.get("type") ?? undefined,
      });
      return apiSuccess({ cameras });
    }
    const dashboard = await getVideoDashboard(organizationId);
    return apiSuccess({ dashboard });
  } catch (e) {
    return handleApiError(e);
  }
}
