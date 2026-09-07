import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import {
  canAcknowledgeAlert,
  canDismissAlert,
  canInvestigateAlert,
  canResolveAlert,
  canViewAlerts,
} from "@/lib/monitoring/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { updateAlertStatus } from "@/lib/monitoring/alert-service";
import { ALERT_STATUSES } from "@/lib/monitoring/constants";

type RouteParams = { params: Promise<{ id: string }> };

const schema = z.object({
  status: z.enum(ALERT_STATUSES),
});

const ACTION_MAP = {
  NEW: null,
  ACKNOWLEDGED: { perm: canAcknowledgeAlert, action: "ALERT_ACKNOWLEDGED" as const },
  INVESTIGATING: { perm: canInvestigateAlert, action: "ALERT_INVESTIGATION_STARTED" as const },
  RESOLVED: { perm: canResolveAlert, action: "ALERT_RESOLVED" as const },
  DISMISSED: { perm: canDismissAlert, action: "ALERT_DISMISSED" as const },
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewAlerts(user)) return apiError("Permission denied.", 403, "FORBIDDEN");

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid status.", 400, "VALIDATION_ERROR");

    const rule = ACTION_MAP[parsed.data.status];
    if (rule && !rule.perm(user)) return apiError("Permission denied.", 403, "FORBIDDEN");

    const { id } = await params;
    const alert = await updateAlertStatus(organizationId, id, parsed.data.status, {
      id: user._id.toString(),
      name: user.name,
    });
    if (!alert) return apiError("Alert not found.", 404, "NOT_FOUND");

    if (rule) {
      await logAuditEvent({
        actor: user,
        action: rule.action,
        description: `${user.name} updated alert ${alert.alertId} to ${parsed.data.status}`,
        request,
        targetType: "Alert",
        targetId: id,
        targetLabel: alert.alertId,
        metadata: { organizationId, status: parsed.data.status },
      });
    }

    return apiSuccess({ alert });
  } catch (error) {
    return handleApiError(error);
  }
}
