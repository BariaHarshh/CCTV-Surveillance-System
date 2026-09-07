import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canViewMonitoring } from "@/lib/monitoring/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { createStreamSession } from "@/lib/monitoring/stream-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewMonitoring(user)) return apiError("Permission denied.", 403, "FORBIDDEN");

    const { id } = await params;
    const stream = await createStreamSession(organizationId, id);
    if (!stream) return apiError("Camera not found.", 404, "NOT_FOUND");

    return apiSuccess({ stream });
  } catch (error) {
    return handleApiError(error);
  }
}
