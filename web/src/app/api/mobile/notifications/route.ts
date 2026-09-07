import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canViewFieldOps } from "@/lib/mobile/permissions";
import { listNotifications, markNotificationRead } from "@/lib/monitoring/notification-service";
import { logAuditEvent } from "@/lib/audit/log";

export async function GET(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewFieldOps(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const url = new URL(request.url);
    const data = await listNotifications(organizationId, user._id.toString(), {
      unreadOnly: url.searchParams.get("unread") === "1",
    });
    const categorized = {
      ALERTS: [] as unknown[],
      TASKS: [] as unknown[],
      INCIDENTS: [] as unknown[],
      EMERGENCY: [] as unknown[],
      SYSTEM: [] as unknown[],
      ANNOUNCEMENTS: [] as unknown[],
    };
    for (const n of data.notifications) {
      const cat = String((n.metadata as { category?: string })?.category || n.type || "SYSTEM").toUpperCase();
      if (cat.includes("TASK")) categorized.TASKS.push(n);
      else if (cat.includes("INCIDENT")) categorized.INCIDENTS.push(n);
      else if (cat.includes("EMERGENCY")) categorized.EMERGENCY.push(n);
      else if (cat.includes("ANNOUNCE")) categorized.ANNOUNCEMENTS.push(n);
      else if (n.type === "ALERT") categorized.ALERTS.push(n);
      else categorized.SYSTEM.push(n);
    }
    return apiSuccess({ ...data, categories: categorized });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewFieldOps(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const body = await request.json();
    if (!body.id) return apiError("Notification id is required", 400, "VALIDATION");
    const updated = await markNotificationRead(organizationId, user._id.toString(), String(body.id));
    if (!updated) return apiError("Notification not found", 404, "NOT_FOUND");
    await logAuditEvent({
      actor: user,
      action: "NOTIFICATION_READ",
      description: `Read notification ${body.id}`,
      organizationId,
    });
    return apiSuccess({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
