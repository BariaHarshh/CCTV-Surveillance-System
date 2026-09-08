import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canViewAnalytics } from "@/lib/analytics/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { parseAnalyticsFilters } from "@/lib/analytics/filters";
import { analyticsService } from "@/lib/analytics/analytics-service";

async function handler(request: NextRequest, fn: (orgId: string, filters: ReturnType<typeof parseAnalyticsFilters>) => Promise<unknown>) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewAnalytics(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const filters = parseAnalyticsFilters(request.nextUrl.searchParams);
    const data = await fn(organizationId, filters);
    return apiSuccess({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path.endsWith("/incidents")) return handler(request, async (o, f) => ({
    summary: await analyticsService.incidents(o, f),
    trend: await analyticsService.incidentTrend(o, f),
    eventTypes: await analyticsService.eventTypes(o, f),
  }));
  return handler(request, analyticsService.incidents);
}
