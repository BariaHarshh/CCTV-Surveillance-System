import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { can } from "@/lib/permissions/capabilities";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getCameraById, updateCamera, deleteCamera } from "@/lib/campus/camera-service";
import { cameraUpdateSchema } from "@/lib/campus/schemas";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!can(user, "camera.view")) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const camera = await getCameraById(organizationId, id);
    if (!camera) return apiError("Camera not found.", 404, "NOT_FOUND");
    return apiSuccess({ camera });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!can(user, "camera.edit")) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const parsed = cameraUpdateSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid data.", 400, "VALIDATION_ERROR");
    const camera = await updateCamera(organizationId, id, parsed.data);
    if (!camera) return apiError("Camera not found.", 404, "NOT_FOUND");
    await logAuditEvent({
      actor: user,
      action: "CAMERA_UPDATED",
      description: `${user.name} updated camera ${camera.cameraId}`,
      request,
      targetType: "Camera",
      targetId: id,
      targetLabel: camera.name,
      metadata: { organizationId },
    });
    return apiSuccess({ camera });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!can(user, "camera.delete")) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const camera = await deleteCamera(organizationId, id);
    if (!camera) return apiError("Camera not found.", 404, "NOT_FOUND");
    await logAuditEvent({
      actor: user,
      action: "CAMERA_REMOVED",
      description: `${user.name} removed camera ${camera.cameraId}`,
      request,
      targetType: "Camera",
      targetId: id,
      targetLabel: camera.name,
      metadata: { organizationId },
    });
    return apiSuccess({ removed: true });
  } catch (error) {
    return handleApiError(error);
  }
}
