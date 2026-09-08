import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canViewNotifications } from "@/lib/monitoring/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { markNotificationRead } from "@/lib/monitoring/notification-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewNotifications(user)) return apiError("Permission denied.", 403, "FORBIDDEN");

    const { id } = await params;
    const notification = await markNotificationRead(organizationId, user._id.toString(), id);
    if (!notification) return apiError("Notification not found.", 404, "NOT_FOUND");

    await logAuditEvent({
      actor: user,
      action: "NOTIFICATION_READ",
      description: `${user.name} read notification ${notification.notificationId}`,
      request,
      metadata: { organizationId },
    });

    return apiSuccess({ notification });
  } catch (error) {
    return handleApiError(error);
  }
}
