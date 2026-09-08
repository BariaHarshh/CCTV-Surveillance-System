import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canViewFieldOps } from "@/lib/mobile/permissions";
import { Alert } from "@/models/Alert";
import { orgFilter } from "@/lib/campus/service";
import { connectDB } from "@/lib/db/connect";

export async function GET() {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewFieldOps(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    await connectDB();
    const alerts = await Alert.find(orgFilter(organizationId, { status: { $ne: "RESOLVED" } }))
      .sort({ createdAt: -1 })
      .limit(50);
    return apiSuccess({
      alerts: alerts.map((a) => ({
        id: a._id.toString(),
        alertId: a.alertId,
        title: a.title,
        severity: a.severity,
        status: a.status,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
