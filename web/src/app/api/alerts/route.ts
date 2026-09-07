import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canViewAlerts } from "@/lib/monitoring/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { listAlerts, getAlertStatistics } from "@/lib/monitoring/alert-service";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewAlerts(user)) return apiError("Permission denied.", 403, "FORBIDDEN");

    const { searchParams } = new URL(request.url);
    if (searchParams.get("stats") === "true") {
      const stats = await getAlertStatistics(organizationId);
      return apiSuccess({ stats });
    }

    const result = await listAlerts(organizationId, {
      q: searchParams.get("q") ?? undefined,
      page: Number(searchParams.get("page") ?? 1),
      limit: Number(searchParams.get("limit") ?? 20),
      severity: searchParams.get("severity") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    });

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
