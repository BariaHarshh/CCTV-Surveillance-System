import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canViewInsights } from "@/lib/analytics/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { listInsights, submitInsightFeedback } from "@/lib/analytics/insight-service";
import { logAuditEvent } from "@/lib/audit/log";
import { INSIGHT_FEEDBACK } from "@/lib/analytics/constants";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewInsights(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const insights = await listInsights(organizationId);
    const insight = insights.find((i) => i.id === id);
    if (!insight) return apiError("Insight not found.", 404, "NOT_FOUND");
    return apiSuccess({ insight });
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({ feedback: z.enum(INSIGHT_FEEDBACK) });

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewInsights(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const url = request.nextUrl.pathname;
    if (!url.endsWith("/feedback") && !(await request.clone().json().catch(() => null))) {
      // allow POST body with feedback on this route too
    }
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid feedback.", 400, "VALIDATION_ERROR");
    const insight = await submitInsightFeedback(organizationId, id, parsed.data.feedback);
    if (!insight) return apiError("Insight not found.", 404, "NOT_FOUND");
    await logAuditEvent({
      actor: user,
      action: "INSIGHT_FEEDBACK",
      description: `${user.name} marked insight as ${parsed.data.feedback}`,
      request,
      targetType: "SafetyInsight",
      targetId: id,
    });
    return apiSuccess({ insight });
  } catch (error) {
    return handleApiError(error);
  }
}
