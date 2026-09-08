import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canViewAnalytics } from "@/lib/analytics/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { deleteSavedView, listSavedViews, saveView } from "@/lib/analytics/report-service";
import { logAuditEvent } from "@/lib/audit/log";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewAnalytics(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const dashboard = request.nextUrl.searchParams.get("dashboard") ?? undefined;
    const views = await listSavedViews(organizationId, user._id.toString(), dashboard);
    return apiSuccess({ views });
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({
  name: z.string().min(2),
  dashboard: z.string().min(2),
  filters: z.record(z.string(), z.unknown()),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewAnalytics(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid view.", 400, "VALIDATION_ERROR");
    const view = await saveView(organizationId, user._id.toString(), parsed.data);
    await logAuditEvent({
      actor: user,
      action: "SAVED_VIEW_CREATED",
      description: `${user.name} saved view ${parsed.data.name}`,
      request,
      targetType: "SavedView",
      targetId: view.id,
    });
    return apiSuccess({ view }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewAnalytics(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return apiError("id required.", 400, "VALIDATION_ERROR");
    const ok = await deleteSavedView(organizationId, user._id.toString(), id);
    if (!ok) return apiError("View not found.", 404, "NOT_FOUND");
    return apiSuccess({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
