import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { summarizeIncident } from "@/lib/intelligence/briefing";
import { assertAIAllowed } from "@/lib/intelligence/orchestrator";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember(["ADMIN", "STAFF"]);
    await assertAIAllowed(organizationId, user);
    const { id } = await ctx.params;
    if (!id) return apiError("Incident id required.", 400, "VALIDATION_ERROR");
    const summary = await summarizeIncident(organizationId, id);
    return apiSuccess({ summary });
  } catch (error) {
    return handleApiError(error);
  }
}
