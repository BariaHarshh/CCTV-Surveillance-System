import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canManageResponseTeams, canViewResponseTeams } from "@/lib/emergency/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { createResponseTeam, listResponseTeams } from "@/lib/emergency/team-service";
import { logAuditEvent } from "@/lib/audit/log";
import { RESPONSE_TEAM_TYPES } from "@/lib/emergency/constants";

export async function GET() {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewResponseTeams(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const teams = await listResponseTeams(organizationId);
    return apiSuccess({ teams });
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({
  name: z.string().min(2).max(100),
  type: z.enum(RESPONSE_TEAM_TYPES).optional(),
  description: z.string().max(500).optional(),
  members: z.array(z.object({ userId: z.string(), name: z.string(), role: z.string().optional() })).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canManageResponseTeams(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid team.", 400, "VALIDATION_ERROR");
    const team = await createResponseTeam(organizationId, parsed.data);
    await logAuditEvent({
      actor: user,
      action: "RESPONSE_TEAM_UPDATED",
      description: `${user.name} created response team ${team.teamId}`,
      request,
      targetType: "ResponseTeam",
      targetId: team.id,
    });
    return apiSuccess({ team }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
