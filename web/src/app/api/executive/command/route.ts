import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canViewExecutive } from "@/lib/analytics/permissions";
import {
  getExecutiveCommandCenter,
  getExecutiveAttention,
  buildExecutiveAiBrief,
  getBillingIntelligence,
  getSystemHealthScore,
  getVideoAiExecutive,
} from "@/lib/bi/executive-service";
import { computeKpiPack, getIncidentForecast, getBenchmarkCampuses } from "@/lib/bi/kpi-engine";
import { logAuditEvent } from "@/lib/audit/log";
import { KpiDefinition } from "@/models/BI";
import { orgFilter } from "@/lib/campus/service";
import { connectDB } from "@/lib/db/connect";

export async function GET(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewExecutive(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const url = new URL(request.url);
    const view = url.searchParams.get("view") || "command";
    const period = (url.searchParams.get("period") || "30D") as "7D" | "30D" | "90D";

    await logAuditEvent({
      actor: user,
      action: "EXECUTIVE_DASHBOARD_VIEWED",
      description: `Executive view=${view}`,
    });

    if (view === "command") {
      return apiSuccess({ executive: await getExecutiveCommandCenter(organizationId, period) });
    }
    if (view === "attention" || view === "alerts") {
      return apiSuccess(await getExecutiveAttention(organizationId));
    }
    if (view === "kpis") {
      return apiSuccess(await computeKpiPack(organizationId, period));
    }
    if (view === "forecast") {
      return apiSuccess({ forecast: await getIncidentForecast(organizationId) });
    }
    if (view === "benchmark") {
      return apiSuccess(await getBenchmarkCampuses(organizationId));
    }
    if (view === "billing") {
      return apiSuccess(await getBillingIntelligence(organizationId));
    }
    if (view === "system") {
      return apiSuccess(await getSystemHealthScore(organizationId));
    }
    if (view === "video-ai") {
      return apiSuccess(await getVideoAiExecutive(organizationId));
    }
    if (view === "copilot") {
      const q = url.searchParams.get("q") || "What requires executive attention?";
      return apiSuccess({ brief: await buildExecutiveAiBrief(organizationId, q) });
    }
    return apiError("Unknown view", 400, "VALIDATION");
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewExecutive(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const body = await request.json();
    if (body.action === "ask") {
      const brief = await buildExecutiveAiBrief(organizationId, String(body.question || ""));
      return apiSuccess({ brief });
    }
    if (body.action === "update_kpi_targets") {
      await connectDB();
      const kpi = await KpiDefinition.findOne(orgFilter(organizationId, { kpiId: String(body.kpiId) }));
      if (!kpi) return apiError("Not found", 404, "NOT_FOUND");
      if (body.target != null) kpi.target = Number(body.target);
      if (body.warningThreshold != null) kpi.warningThreshold = Number(body.warningThreshold);
      if (body.criticalThreshold != null) kpi.criticalThreshold = Number(body.criticalThreshold);
      await kpi.save();
      await logAuditEvent({
        actor: user,
        action: "KPI_TARGETS_UPDATED",
        description: `Updated ${kpi.kpiId}`,
        targetId: kpi.kpiId,
      });
      return apiSuccess({ kpiId: kpi.kpiId });
    }
    return apiError("Unknown action", 400, "VALIDATION");
  } catch (e) {
    return handleApiError(e);
  }
}
