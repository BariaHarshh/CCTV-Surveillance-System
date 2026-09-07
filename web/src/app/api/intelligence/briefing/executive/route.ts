import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { buildExecutiveSummary } from "@/lib/intelligence/briefing";
import { assertAIAllowed } from "@/lib/intelligence/orchestrator";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember(["ADMIN", "STAFF"]);
    await assertAIAllowed(organizationId, user);
    const range = new URL(request.url).searchParams.get("range") ?? "week";
    if (!["today", "week", "month"].includes(range)) {
      return apiError("range must be today|week|month.", 400, "VALIDATION_ERROR");
    }
    const summary = await buildExecutiveSummary(organizationId, range as "today" | "week" | "month");
    return apiSuccess({ summary });
  } catch (error) {
    return handleApiError(error);
  }
}
