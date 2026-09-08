import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canManageResponseTeams } from "@/lib/emergency/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { updateResponseTeam } from "@/lib/emergency/team-service";
import { logAuditEvent } from "@/lib/audit/log";
import { RESPONSE_TEAM_STATUSES, RESPONSE_TEAM_TYPES } from "@/lib/emergency/constants";

type RouteParams = { params: Promise<{ id: string }> };

const schema = z.object({
  name: z.string().optional(),
  type: z.enum(RESPONSE_TEAM_TYPES).optional(),
  status: z.enum(RESPONSE_TEAM_STATUSES).optional(),
  description: z.string().optional(),
  members: z.array(z.object({ userId: z.string(), name: z.string(), role: z.string().optional() })).optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canManageResponseTeams(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid update.", 400, "VALIDATION_ERROR");
    const team = await updateResponseTeam(organizationId, id, parsed.data);
    if (!team) return apiError("Team not found.", 404, "NOT_FOUND");
    await logAuditEvent({
      actor: user,
      action: "RESPONSE_TEAM_UPDATED",
      description: `${user.name} updated response team ${id}`,
      request,
      targetType: "ResponseTeam",
      targetId: id,
    });
    return apiSuccess({ team });
  } catch (error) {
    return handleApiError(error);
  }
}
