import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canResolveEmergency } from "@/lib/emergency/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { updateEmergencyStatus } from "@/lib/emergency/emergency-service";
import { logAuditEvent } from "@/lib/audit/log";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canResolveEmergency(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const result = await updateEmergencyStatus(
      organizationId,
      id,
      "RESOLVED",
      { id: user._id.toString(), name: user.name },
      typeof body.notes === "string" ? body.notes : undefined
    );
    if ("error" in result) {
      if (result.error === "NOT_FOUND") return apiError("Emergency not found.", 404, "NOT_FOUND");
      return apiError(`Invalid transition from ${result.from} to ${result.to}.`, 400, "INVALID_TRANSITION");
    }
    await logAuditEvent({
      actor: user,
      action: "EMERGENCY_RESOLVED",
      description: `${user.name} resolved emergency ${id}`,
      request,
      targetType: "Emergency",
      targetId: id,
      severity: "warning",
    });
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
