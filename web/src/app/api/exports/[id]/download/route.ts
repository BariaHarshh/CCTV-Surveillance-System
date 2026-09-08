import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canExportAnalytics } from "@/lib/analytics/permissions";
import { apiError, handleApiError } from "@/lib/api/response";
import { getReportDownload } from "@/lib/analytics/report-service";
import { logAuditEvent } from "@/lib/audit/log";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canExportAnalytics(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const file = await getReportDownload(organizationId, id);
    if (!file) return apiError("Export not ready.", 404, "NOT_FOUND");
    await logAuditEvent({
      actor: user,
      action: "DATA_EXPORTED",
      description: `${user.name} downloaded export ${file.reportId}`,
      request,
      targetType: "AnalyticsReport",
      targetId: id,
    });
    return new Response(file.content, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${file.reportId}.csv"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
