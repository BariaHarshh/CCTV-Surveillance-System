import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canViewMonitoring } from "@/lib/monitoring/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getCameraById } from "@/lib/campus/camera-service";
import { listEvents } from "@/lib/monitoring/event-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewMonitoring(user)) return apiError("Permission denied.", 403, "FORBIDDEN");

    const { id } = await params;
    const camera = await getCameraById(organizationId, id);
    if (!camera) return apiError("Camera not found.", 404, "NOT_FOUND");

    const events = await listEvents(organizationId, { cameraId: id, limit: 10 });

    return apiSuccess({ camera, recentEvents: events.events });
  } catch (error) {
    return handleApiError(error);
  }
}
