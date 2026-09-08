import { NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiError, handleApiError } from "@/lib/api/response";
import { canViewFloorPlanDrafts, canViewMap } from "@/lib/map/permissions";
import { readFloorPlanImage } from "@/lib/map/floor-plan-service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ floorPlanId: string }> }
) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewMap(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const { floorPlanId } = await context.params;
    const img = await readFloorPlanImage(
      organizationId,
      floorPlanId,
      canViewFloorPlanDrafts(user)
    );
    if (!img) return apiError("Floor plan image not found", 404, "NOT_FOUND");
    return new NextResponse(new Uint8Array(img.buffer), {
      status: 200,
      headers: {
        "Content-Type": img.mimeType,
        "Cache-Control": "private, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
