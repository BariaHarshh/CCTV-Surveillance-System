import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { searchKnowledge } from "@/lib/intelligence/rag";
import { getOrCreatePrivacy } from "@/lib/intelligence/orchestrator";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { organizationId } = await requireOrgMember(["ADMIN", "STAFF"]);
    const privacy = await getOrCreatePrivacy(organizationId);
    if (!privacy.knowledgeBaseEnabled) {
      return apiError("Knowledge base is disabled for this organization.", 403, "FEATURE_NOT_AVAILABLE");
    }

    const q = new URL(request.url).searchParams.get("q") ?? "";
    if (q.trim().length < 2) return apiError("Query q must be at least 2 characters.", 400, "VALIDATION_ERROR");
    const limit = Math.min(20, Math.max(1, Number(new URL(request.url).searchParams.get("limit") ?? 5)));
    const hits = await searchKnowledge(organizationId, q, limit);
    return apiSuccess({ query: q, hits });
  } catch (error) {
    return handleApiError(error);
  }
}
