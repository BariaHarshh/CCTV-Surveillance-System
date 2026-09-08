import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { canViewAnalytics } from "@/lib/analytics/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { analyticsAggregationWorker } from "@/lib/analytics/aggregation-worker";
import { analyticsService } from "@/lib/analytics/analytics-service";
import { detectPatterns } from "@/lib/analytics/pattern-service";
import { generateInsights } from "@/lib/analytics/insight-service";
import { isTestModeEnabled } from "@/lib/monitoring/internal-auth";

export async function POST(request: NextRequest) {
  try {
    if (!isTestModeEnabled()) return apiError("Test mode unavailable.", 403, "FORBIDDEN");
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!canViewAnalytics(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const body = await request.json().catch(() => ({}));
    const action = body.action as string;

    if (action === "aggregate") {
      const result = await analyticsAggregationWorker.aggregateDaily(organizationId);
      return apiSuccess({ result, source: "TEST" });
    }
    if (action === "anomalies") {
      const result = await analyticsAggregationWorker.detectAnomalies(organizationId);
      return apiSuccess({ ...result, source: "TEST" });
    }
    if (action === "patterns") {
      const result = await detectPatterns(organizationId, { includeTest: true });
      return apiSuccess({ ...result, source: "TEST" });
    }
    if (action === "insights") {
      const result = await generateInsights(organizationId, {});
      return apiSuccess({ ...result, source: "TEST" });
    }
    if (action === "overview") {
      const overview = await analyticsService.overview(organizationId, {});
      return apiSuccess({ overview, source: "TEST" });
    }
    if (action === "executive") {
      const overview = await analyticsService.executive(organizationId, {});
      return apiSuccess({ overview, source: "TEST" });
    }
    if (action === "data-quality") {
      const data = await analyticsService.dataQuality(organizationId);
      return apiSuccess({ data, source: "TEST" });
    }

    return apiError("Unknown analytics test action.", 400, "VALIDATION_ERROR");
  } catch (error) {
    return handleApiError(error);
  }
}
