import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { can } from "@/lib/permissions/capabilities";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { updateBuildingStatus } from "@/lib/campus/building-service";
import { buildingStatusSchema } from "@/lib/campus/schemas";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!can(user, "building.status")) return apiError("Permission denied.", 403, "FORBIDDEN");

    const { id } = await params;
    const parsed = buildingStatusSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid status.", 400, "VALIDATION_ERROR");

    const building = await updateBuildingStatus(organizationId, id, parsed.data.status);
    if (!building) return apiError("Building not found.", 404, "NOT_FOUND");

    await logAuditEvent({
      actor: user,
      action: "BUILDING_STATUS_CHANGED",
      description: `${user.name} set building ${building.buildingId} to ${parsed.data.status}`,
      request,
      targetType: "Building",
      targetId: id,
      targetLabel: building.name,
      metadata: { organizationId, status: parsed.data.status },
    });
    return apiSuccess({ building });
  } catch (error) {
    return handleApiError(error);
  }
}
