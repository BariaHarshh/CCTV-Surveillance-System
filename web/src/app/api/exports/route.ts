import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canExportAnalytics } from "@/lib/analytics/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { createExportJob } from "@/lib/analytics/report-service";
import { logAuditEvent } from "@/lib/audit/log";

const schema = z.object({
  type: z.enum(["INCIDENT", "ALERT"]),
  filters: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canExportAnalytics(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid export.", 400, "VALIDATION_ERROR");
    const report = await createExportJob(
      organizationId,
      { type: parsed.data.type, filters: parsed.data.filters as Record<string, string> },
      { id: user._id.toString(), name: user.name }
    );
    await logAuditEvent({
      actor: user,
      action: "DATA_EXPORTED",
      description: `${user.name} requested ${parsed.data.type} export`,
      request,
      targetType: "AnalyticsReport",
      targetId: report.id,
    });
    return apiSuccess({ export: report }, 202);
  } catch (error) {
    return handleApiError(error);
  }
}
