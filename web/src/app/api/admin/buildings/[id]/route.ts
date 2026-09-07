import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { can } from "@/lib/permissions/capabilities";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getBuildingById, updateBuilding } from "@/lib/campus/building-service";
import { buildingUpdateSchema } from "@/lib/campus/schemas";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!can(user, "building.view")) return apiError("Permission denied.", 403, "FORBIDDEN");

    const { id } = await params;
    const building = await getBuildingById(organizationId, id);
    if (!building) return apiError("Building not found.", 404, "NOT_FOUND");
    return apiSuccess({ building });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!can(user, "building.edit")) return apiError("Permission denied.", 403, "FORBIDDEN");

    const { id } = await params;
    const body = await request.json();
    const parsed = buildingUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid data.", 400, "VALIDATION_ERROR");
    }

    const building = await updateBuilding(organizationId, id, parsed.data);
    if (!building) return apiError("Building not found.", 404, "NOT_FOUND");

    await logAuditEvent({
      actor: user,
      action: "BUILDING_UPDATED",
      description: `${user.name} updated building ${building.buildingId}`,
      request,
      targetType: "Building",
      targetId: id,
      targetLabel: building.name,
      metadata: { organizationId },
    });
    return apiSuccess({ building });
  } catch (error) {
    return handleApiError(error);
  }
}
