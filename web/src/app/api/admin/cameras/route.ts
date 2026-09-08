import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { can } from "@/lib/permissions/capabilities";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { listCameras, createCamera } from "@/lib/campus/camera-service";
import { cameraCreateSchema } from "@/lib/campus/schemas";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!can(user, "camera.view")) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { searchParams } = new URL(request.url);
    const cameras = await listCameras(organizationId, {
      q: searchParams.get("q") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });
    return apiSuccess({ cameras });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!can(user, "camera.create")) return apiError("Permission denied.", 403, "FORBIDDEN");
    const parsed = cameraCreateSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid data.", 400, "VALIDATION_ERROR");
    const camera = await createCamera(organizationId, parsed.data);
    await logAuditEvent({
      actor: user,
      action: "CAMERA_CREATED",
      description: `${user.name} added camera ${camera.cameraId}`,
      request,
      targetType: "Camera",
      targetId: camera.id,
      targetLabel: camera.name,
      metadata: { organizationId, cameraId: camera.cameraId },
    });
    return apiSuccess({ camera }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
