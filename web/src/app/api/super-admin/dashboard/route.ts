import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { logAuditEvent } from "@/lib/audit/log";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import {
  getPlatformStatistics,
  getRecentActivity,
  getOrganizationsList,
  getAdminsList,
  getSystemHealthStatus,
} from "@/lib/super-admin/statistics";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const actor = await requireSuperAdmin();

    const [statistics, activity, organizations, admins, systemHealth] =
      await Promise.all([
        getPlatformStatistics(),
        getRecentActivity(15),
        getOrganizationsList(),
        getAdminsList(),
        getSystemHealthStatus(),
      ]);

    await logAuditEvent({
      actor,
      action: "VIEW_DASHBOARD",
      description: "Super Admin viewed platform dashboard",
      request,
    });

    return apiSuccess({
      statistics,
      activity,
      organizations,
      admins,
      systemHealth,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
