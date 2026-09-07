import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { logAuditEvent } from "@/lib/audit/log";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getAdminDashboardData } from "@/lib/admin/statistics";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId, organization } = await requireAdmin();

    const data = await getAdminDashboardData(organizationId);

    await logAuditEvent({
      actor: user,
      action: "VIEW_DASHBOARD",
      description: `${user.name} viewed organization dashboard`,
      request,
      metadata: { organizationId, organizationName: organization.basicInformation.name },
    });

    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
