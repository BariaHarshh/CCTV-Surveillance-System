import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canViewNotifications } from "@/lib/monitoring/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { markAllNotificationsRead } from "@/lib/monitoring/notification-service";

export async function PATCH(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewNotifications(user)) return apiError("Permission denied.", 403, "FORBIDDEN");

    await markAllNotificationsRead(organizationId, user._id.toString());

    await logAuditEvent({
      actor: user,
      action: "NOTIFICATION_READ",
      description: `${user.name} marked all notifications as read`,
      request,
      metadata: { organizationId, all: true },
    });

    return apiSuccess({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
