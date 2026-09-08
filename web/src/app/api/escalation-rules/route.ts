import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { canManageEmergency, canViewEmergency } from "@/lib/emergency/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { createEscalationRule, listEscalationRules } from "@/lib/emergency/escalation-engine";
import { SEVERITY_LEVELS } from "@/lib/monitoring/constants";
import { ESCALATION_LEVELS } from "@/lib/emergency/constants";

export async function GET() {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!canViewEmergency(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const rules = await listEscalationRules(organizationId);
    return apiSuccess({ rules });
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({
  name: z.string().min(2),
  severity: z.enum(SEVERITY_LEVELS),
  eventTypes: z.array(z.string()).optional(),
  timeoutMinutes: z.number().min(1).max(240).optional(),
  levels: z
    .array(
      z.object({
        level: z.enum(ESCALATION_LEVELS),
        roleLabel: z.string().optional(),
        timeoutMinutes: z.number().optional(),
        teamId: z.string().nullable().optional(),
      })
    )
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!canManageEmergency(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid rule.", 400, "VALIDATION_ERROR");
    const rule = await createEscalationRule(organizationId, parsed.data);
    return apiSuccess({ rule }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
