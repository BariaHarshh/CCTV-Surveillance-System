import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canManageActions, canViewActions } from "@/lib/analytics/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { listActions, updateAction } from "@/lib/analytics/action-service";
import { ACTION_PRIORITIES, ACTION_STATUSES } from "@/lib/analytics/constants";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewActions(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const result = await listActions(organizationId);
    const action = result.actions.find((a) => a.id === id);
    if (!action) return apiError("Action not found.", 404, "NOT_FOUND");
    return apiSuccess({ action });
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  priority: z.enum(ACTION_PRIORITIES).optional(),
  status: z.enum(ACTION_STATUSES).optional(),
  dueAt: z.string().nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canManageActions(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid update.", 400, "VALIDATION_ERROR");
    const action = await updateAction(organizationId, id, parsed.data);
    if (!action) return apiError("Action not found.", 404, "NOT_FOUND");
    return apiSuccess({ action });
  } catch (error) {
    return handleApiError(error);
  }
}
