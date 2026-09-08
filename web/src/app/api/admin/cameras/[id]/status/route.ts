import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { can } from "@/lib/permissions/capabilities";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { updateCameraStatus } from "@/lib/campus/camera-service";
import { cameraStatusSchema } from "@/lib/campus/schemas";
import { broadcastCameraStatus } from "@/lib/monitoring/socket-emitter";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!can(user, "camera.status")) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const parsed = cameraStatusSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid status.", 400, "VALIDATION_ERROR");

    let status = parsed.data.status;
    if (parsed.data.action === "enable") status = "OFFLINE";
    if (parsed.data.action === "disable") status = "DISABLED";

    const camera = await updateCameraStatus(organizationId, id, status);
    if (!camera) return apiError("Camera not found.", 404, "NOT_FOUND");

    broadcastCameraStatus(organizationId, {
      cameraId: camera.cameraId,
      status: camera.status,
      timestamp: new Date().toISOString(),
      lastSeen: camera.lastSeen,
    });

    await logAuditEvent({
      actor: user,
      action: status === "DISABLED" ? "CAMERA_DISABLED" : "CAMERA_ENABLED",
      description: `${user.name} updated camera ${camera.cameraId} status to ${status}`,
      request,
      targetType: "Camera",
      targetId: id,
      targetLabel: camera.name,
      metadata: { organizationId, status },
    });
    return apiSuccess({ camera });
  } catch (error) {
    return handleApiError(error);
  }
}
