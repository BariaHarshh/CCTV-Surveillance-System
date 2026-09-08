import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { canManageEmergency } from "@/lib/emergency/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { updateEscalationRule } from "@/lib/emergency/escalation-engine";

type RouteParams = { params: Promise<{ id: string }> };

const schema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  timeoutMinutes: z.number().min(1).max(240).optional(),
  eventTypes: z.array(z.string()).optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!canManageEmergency(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid update.", 400, "VALIDATION_ERROR");
    const rule = await updateEscalationRule(organizationId, id, parsed.data);
    if (!rule) return apiError("Rule not found.", 404, "NOT_FOUND");
    return apiSuccess({ rule });
  } catch (error) {
    return handleApiError(error);
  }
}
