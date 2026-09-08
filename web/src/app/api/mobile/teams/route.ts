import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canViewTeams, canManageTeams } from "@/lib/mobile/permissions";
import { getTeamsOverview, getTeamDetail, recommendResponders } from "@/lib/mobile/field-service";
import { updateResponseTeam } from "@/lib/emergency/team-service";

export async function GET(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewTeams(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (url.searchParams.get("recommend") === "1") {
      return apiSuccess(await recommendResponders(organizationId, { skill: url.searchParams.get("skill") || undefined }));
    }
    if (id) {
      const team = await getTeamDetail(organizationId, id);
      if (!team) return apiError("Not found", 404, "NOT_FOUND");
      return apiSuccess(team);
    }
    return apiSuccess({ teams: await getTeamsOverview(organizationId) });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canManageTeams(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const body = await request.json();
    const result = await updateResponseTeam(organizationId, String(body.id || ""), {
      status: body.status,
      currentAssignment: body.currentAssignment,
    });
    if (!result) return apiError("Not found", 404, "NOT_FOUND");
    return apiSuccess({ team: result });
  } catch (e) {
    return handleApiError(e);
  }
}
