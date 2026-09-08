import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { canConfigureAI, canViewAI } from "@/lib/ai/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getAIModulesOverview, getOrCreateOrgAISettings, updateOrgAISettings } from "@/lib/ai/config-service";

export async function GET() {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!canViewAI(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const overview = await getAIModulesOverview(organizationId);
    return apiSuccess({ overview });
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  defaultConfidenceThreshold: z.number().min(0).max(1).optional(),
  eventCooldownSeconds: z.number().min(0).max(3600).optional(),
  occupancyThresholds: z.object({ elevated: z.number(), high: z.number(), critical: z.number() }).optional(),
  abandonedObjectThresholdSeconds: z.number().min(0).optional(),
  afterHoursSeverity: z.string().optional(),
  notificationRules: z.record(z.string(), z.string()).optional(),
  dataRetention: z.object({
    eventsDays: z.number(),
    snapshotsDays: z.number(),
    incidentsDays: z.number(),
    auditDays: z.number(),
  }).optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!canConfigureAI(user)) return apiError("Permission denied.", 403, "FORBIDDEN");

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid configuration.", 400, "VALIDATION_ERROR");

    const settings = await updateOrgAISettings(organizationId, parsed.data);

    await logAuditEvent({
      actor: user,
      action: "AI_CONFIGURATION_UPDATED",
      description: `${user.name} updated organization AI settings`,
      request,
      metadata: { organizationId },
    });

    return apiSuccess({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}
