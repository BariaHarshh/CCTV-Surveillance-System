import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canManageFloorPlans, canViewFloorPlanDrafts, canViewMap } from "@/lib/map/permissions";
import { listFloorPlans, setFloorPlanStatus, uploadFloorPlan } from "@/lib/map/floor-plan-service";

export async function GET(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewMap(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const url = new URL(request.url);
    const plans = await listFloorPlans(organizationId, {
      buildingId: url.searchParams.get("buildingId") ?? undefined,
      floorId: url.searchParams.get("floorId") ?? undefined,
      includeDrafts: canViewFloorPlanDrafts(user),
    });
    return apiSuccess({ floorPlans: plans });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canManageFloorPlans(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const form = await request.formData();
    const file = form.get("file");
    const buildingId = String(form.get("buildingId") || "");
    const floorId = form.get("floorId") ? String(form.get("floorId")) : undefined;
    const level = form.get("level") ? Number(form.get("level")) : undefined;
    if (!(file instanceof File)) return apiError("file is required", 400, "VALIDATION");
    if (!buildingId) return apiError("buildingId is required", 400, "VALIDATION");
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadFloorPlan({
      organizationId,
      user,
      buildingId,
      floorId,
      level,
      file: {
        buffer,
        mimeType: file.type || "application/octet-stream",
        originalName: file.name,
      },
    });
    return apiSuccess({ floorPlan: result }, 201);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canManageFloorPlans(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const body = await request.json();
    const floorPlanId = String(body.floorPlanId || "");
    const status = String(body.status || "");
    if (!floorPlanId || !["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) {
      return apiError("Invalid payload", 400, "VALIDATION");
    }
    const result = await setFloorPlanStatus(
      organizationId,
      user,
      floorPlanId,
      status as "DRAFT" | "PUBLISHED" | "ARCHIVED"
    );
    if (!result) return apiError("Floor plan not found", 404, "NOT_FOUND");
    return apiSuccess({ floorPlan: result });
  } catch (e) {
    return handleApiError(e);
  }
}
