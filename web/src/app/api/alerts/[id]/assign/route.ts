import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canViewAlerts } from "@/lib/monitoring/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { assignAlert } from "@/lib/monitoring/alert-service";

type RouteParams = { params: Promise<{ id: string }> };

const schema = z.object({ assigneeId: z.string().min(1) });

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember(["ADMIN"]);
    if (!canViewAlerts(user)) return apiError("Permission denied.", 403, "FORBIDDEN");

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid assignee.", 400, "VALIDATION_ERROR");

    const { id } = await params;
    const alert = await assignAlert(organizationId, id, parsed.data.assigneeId);
    if (!alert) return apiError("Alert not found.", 404, "NOT_FOUND");

    await logAuditEvent({
      actor: user,
      action: "ALERT_ASSIGNED",
      description: `${user.name} assigned alert ${alert.alertId} to ${alert.assignedToName}`,
      request,
      targetType: "Alert",
      targetId: id,
      targetLabel: alert.alertId,
      metadata: { organizationId, assigneeId: parsed.data.assigneeId },
    });

    return apiSuccess({ alert });
  } catch (error) {
    return handleApiError(error);
  }
}
