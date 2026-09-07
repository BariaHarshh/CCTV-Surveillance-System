import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireStaff } from "@/lib/auth/require-staff";
import { can } from "@/lib/permissions/capabilities";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { listCameras } from "@/lib/campus/camera-service";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireStaff();
    if (!can(user, "camera.view")) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { searchParams } = new URL(request.url);
    const cameras = await listCameras(organizationId, { status: searchParams.get("status") ?? undefined });
    return apiSuccess({ cameras });
  } catch (error) {
    return handleApiError(error);
  }
}
