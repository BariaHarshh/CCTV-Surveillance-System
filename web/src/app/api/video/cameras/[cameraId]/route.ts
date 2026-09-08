import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canConfigureVideo, canLiveView, canViewVideo } from "@/lib/video/permissions";
import { getVideoCameraDetail, testCameraConnection } from "@/lib/video/video-service";
import { createStreamSession } from "@/lib/monitoring/stream-service";
import { logAuditEvent } from "@/lib/audit/log";
import { handleCameraOffline } from "@/lib/video/pipeline";

export async function GET(
  _request: Request,
  context: { params: Promise<{ cameraId: string }> }
) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewVideo(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const { cameraId } = await context.params;
    const detail = await getVideoCameraDetail(organizationId, cameraId);
    if (!detail) return apiError("Camera not found", 404, "NOT_FOUND");
    await logAuditEvent({
      actor: user,
      action: "CAMERA_VIEWED",
      description: `Viewed video camera ${detail.camera.cameraId}`,
      targetType: "Camera",
      targetId: detail.camera.id,
    });
    return apiSuccess({ camera: detail });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ cameraId: string }> }
) {
  try {
    const { user, organizationId } = await requireOrgMember();
    const { cameraId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "stream");

    if (action === "stream") {
      if (!canLiveView(user)) return apiError("Forbidden", 403, "FORBIDDEN");
      const detail = await getVideoCameraDetail(organizationId, cameraId);
      if (!detail) return apiError("Camera not found", 404, "NOT_FOUND");
      const session = await createStreamSession(organizationId, detail.camera.id);
      await logAuditEvent({
        actor: user,
        action: "STREAM_ACCESSED",
        description: `Stream session for ${detail.camera.cameraId}`,
        targetType: "Camera",
        targetId: detail.camera.id,
      });
      return apiSuccess({ stream: session });
    }

    if (action === "test") {
      if (!canConfigureVideo(user)) return apiError("Forbidden", 403, "FORBIDDEN");
      const result = await testCameraConnection(organizationId, cameraId);
      if (!result) return apiError("Camera not found", 404, "NOT_FOUND");
      return apiSuccess({ test: result });
    }

    if (action === "mark_offline") {
      if (!canConfigureVideo(user)) return apiError("Forbidden", 403, "FORBIDDEN");
      const detail = await getVideoCameraDetail(organizationId, cameraId);
      if (!detail) return apiError("Camera not found", 404, "NOT_FOUND");
      const result = await handleCameraOffline(organizationId, detail.camera.id);
      return apiSuccess({ result });
    }

    return apiError("Unknown action", 400, "VALIDATION");
  } catch (e) {
    return handleApiError(e);
  }
}
