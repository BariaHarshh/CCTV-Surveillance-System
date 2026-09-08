import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { canConfigureAI } from "@/lib/ai/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { deleteRestrictedZone, updateRestrictedZone } from "@/lib/ai/zone-service";

type RouteParams = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  scheduleId: z.string().nullable().optional(),
  allowedRoles: z.array(z.string()).optional(),
  polygon: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!canConfigureAI(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid update.", 400, "VALIDATION_ERROR");
    const zone = await updateRestrictedZone(organizationId, id, parsed.data);
    if (!zone) return apiError("Zone not found.", 404, "NOT_FOUND");
    return apiSuccess({ zone });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!canConfigureAI(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const ok = await deleteRestrictedZone(organizationId, id);
    if (!ok) return apiError("Zone not found.", 404, "NOT_FOUND");
    return apiSuccess({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
