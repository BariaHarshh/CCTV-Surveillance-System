import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canGenerateReports, canViewReports } from "@/lib/analytics/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { createReportJob, listReports } from "@/lib/analytics/report-service";
import { logAuditEvent } from "@/lib/audit/log";
import { REPORT_FORMATS, REPORT_TYPES } from "@/lib/analytics/constants";

export async function GET() {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewReports(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const reports = await listReports(organizationId);
    return apiSuccess({ reports });
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({
  type: z.enum(REPORT_TYPES),
  format: z.enum(REPORT_FORMATS).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canGenerateReports(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid report request.", 400, "VALIDATION_ERROR");
    const report = await createReportJob(
      organizationId,
      {
        type: parsed.data.type,
        format: parsed.data.format,
        filters: (parsed.data.filters ?? {}) as Record<string, string>,
      },
      { id: user._id.toString(), name: user.name }
    );
    await logAuditEvent({
      actor: user,
      action: "REPORT_GENERATED",
      description: `${user.name} queued ${parsed.data.type} report`,
      request,
      targetType: "AnalyticsReport",
      targetId: report.id,
      metadata: { type: parsed.data.type, format: parsed.data.format },
    });
    return apiSuccess({ report }, 202);
  } catch (error) {
    return handleApiError(error);
  }
}
