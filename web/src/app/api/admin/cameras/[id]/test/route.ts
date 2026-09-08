import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { can } from "@/lib/permissions/capabilities";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { testCameraConnection } from "@/lib/campus/camera-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!can(user, "camera.test")) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const result = await testCameraConnection(organizationId, id);
    if (!result) return apiError("Camera not found.", 404, "NOT_FOUND");

    await logAuditEvent({
      actor: user,
      action: "CAMERA_TESTED",
      description: `${user.name} tested camera ${result.camera.cameraId}: ${result.message}`,
      request,
      targetType: "Camera",
      targetId: id,
      targetLabel: result.camera.name,
      metadata: { organizationId, success: result.success },
    });

    return apiSuccess({
      success: result.success,
      message: result.success ? "Camera Connected" : "Unable to Connect",
      camera: result.camera,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
