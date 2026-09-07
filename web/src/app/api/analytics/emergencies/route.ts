import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canViewAnalytics } from "@/lib/analytics/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { parseAnalyticsFilters } from "@/lib/analytics/filters";
import { analyticsService } from "@/lib/analytics/analytics-service";
import { getActiveEscalations } from "@/lib/emergency/escalation-engine";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewAnalytics(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const filters = parseAnalyticsFilters(request.nextUrl.searchParams);
    const [summary, escalations] = await Promise.all([
      analyticsService.emergencies(organizationId, filters),
      getActiveEscalations(organizationId),
    ]);
    const byLevel: Record<string, number> = {};
    for (const e of escalations) {
      byLevel[e.currentLevel] = (byLevel[e.currentLevel] ?? 0) + 1;
    }
    return apiSuccess({
      data: {
        summary,
        escalations: {
          total: escalations.length,
          byLevel,
          acknowledged: escalations.filter((e) => e.status === "ACKNOWLEDGED").length,
          active: escalations.filter((e) => e.status === "ACTIVE").length,
        },
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
