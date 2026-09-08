import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canManageEmergency, canViewEmergency } from "@/lib/emergency/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { listMessages, sendMessage } from "@/lib/emergency/contact-service";
import { logAuditEvent } from "@/lib/audit/log";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewEmergency(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const result = await listMessages(organizationId, id);
    if ("error" in result) return apiError("Emergency not found.", 404, "NOT_FOUND");
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({ message: z.string().min(1).max(2000) });

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canManageEmergency(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid message.", 400, "VALIDATION_ERROR");
    const result = await sendMessage(organizationId, id, { id: user._id.toString(), name: user.name }, parsed.data.message);
    if ("error" in result) return apiError("Emergency not found.", 404, "NOT_FOUND");
    await logAuditEvent({
      actor: user,
      action: "EMERGENCY_MESSAGE_SENT",
      description: `${user.name} sent emergency message`,
      request,
      targetType: "Emergency",
      targetId: id,
    });
    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
