import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canViewEvents } from "@/lib/monitoring/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { listEvents } from "@/lib/monitoring/event-service";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewEvents(user)) return apiError("Permission denied.", 403, "FORBIDDEN");

    const { searchParams } = new URL(request.url);
    const result = await listEvents(organizationId, {
      q: searchParams.get("q") ?? undefined,
      page: Number(searchParams.get("page") ?? 1),
      limit: Number(searchParams.get("limit") ?? 20),
      severity: searchParams.get("severity") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      eventType: searchParams.get("eventType") ?? undefined,
      cameraId: searchParams.get("cameraId") ?? undefined,
      buildingId: searchParams.get("buildingId") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    });

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
