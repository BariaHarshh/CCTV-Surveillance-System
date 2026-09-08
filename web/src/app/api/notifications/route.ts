import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canViewNotifications } from "@/lib/monitoring/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { listNotifications } from "@/lib/monitoring/notification-service";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewNotifications(user)) return apiError("Permission denied.", 403, "FORBIDDEN");

    const unreadOnly = new URL(request.url).searchParams.get("unread") === "true";
    const result = await listNotifications(organizationId, user._id.toString(), { unreadOnly });
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
