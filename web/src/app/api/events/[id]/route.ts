import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canViewEvents } from "@/lib/monitoring/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getEventById } from "@/lib/monitoring/event-service";
import { Alert } from "@/models/Alert";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewEvents(user)) return apiError("Permission denied.", 403, "FORBIDDEN");

    const { id } = await params;
    const event = await getEventById(organizationId, id);
    if (!event) return apiError("Event not found.", 404, "NOT_FOUND");

    const relatedAlert = await Alert.findOne({ organizationId, eventId: id }).select("alertId _id status");

    await logAuditEvent({
      actor: user,
      action: "EVENT_VIEWED",
      description: `${user.name} viewed event ${event.eventId}`,
      request,
      targetType: "Event",
      targetId: id,
      targetLabel: event.eventId,
      metadata: { organizationId },
    });

    return apiSuccess({
      event,
      relatedAlert: relatedAlert
        ? { id: relatedAlert._id.toString(), alertId: relatedAlert.alertId, status: relatedAlert.status }
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
