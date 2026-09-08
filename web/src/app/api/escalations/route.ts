import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canManageEmergency } from "@/lib/emergency/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { acknowledgeEscalation, getActiveEscalations } from "@/lib/emergency/escalation-engine";
import { logAuditEvent } from "@/lib/audit/log";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canManageEmergency(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const emergencyId = request.nextUrl.searchParams.get("emergencyId") ?? undefined;
    const escalations = await getActiveEscalations(organizationId, emergencyId);
    return apiSuccess({ escalations, serverNow: new Date().toISOString() });
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({
  escalationId: z.string(),
  action: z.enum(["acknowledge"]),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canManageEmergency(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid request.", 400, "VALIDATION_ERROR");
    const result = await acknowledgeEscalation(organizationId, parsed.data.escalationId, {
      id: user._id.toString(),
      name: user.name,
    });
    if (!result) return apiError("Escalation not found.", 404, "NOT_FOUND");
    if ("error" in result) return apiError("Escalation is not active.", 400, "NOT_ACTIVE");
    await logAuditEvent({
      actor: user,
      action: "ESCALATION_ACKNOWLEDGED",
      description: `${user.name} acknowledged escalation`,
      request,
      targetType: "ActiveEscalation",
      targetId: parsed.data.escalationId,
    });
    return apiSuccess({ escalation: result });
  } catch (error) {
    return handleApiError(error);
  }
}
