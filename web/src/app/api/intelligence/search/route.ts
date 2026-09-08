import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { detectIntent, executeTool, toolAllowed } from "@/lib/intelligence/tools";
import { searchKnowledge } from "@/lib/intelligence/rag";
import { getOrCreatePrivacy } from "@/lib/intelligence/orchestrator";
import type { ToolExecutionContext } from "@/lib/intelligence/types";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember(["ADMIN", "STAFF"]);
    const q = new URL(request.url).searchParams.get("q") ?? "";
    if (q.trim().length < 2) return apiError("Query q must be at least 2 characters.", 400, "VALIDATION_ERROR");

    const privacy = await getOrCreatePrivacy(organizationId);
    const intent = detectIntent(q);
    const ctx: ToolExecutionContext = {
      userId: user._id.toString(),
      organizationId,
      role: user.role,
      permissions: user.permissions ?? [],
      user,
    };

    const results: Array<{ type: string; title: string; href?: string; id?: string; meta?: string }> = [];

    if (privacy.knowledgeBaseEnabled) {
      const hits = await searchKnowledge(organizationId, q, 5);
      for (const h of hits) {
        results.push({
          type: "knowledge",
          title: h.title,
          href: h.href,
          id: h.documentId,
          meta: `${h.section} · v${h.version}`,
        });
      }
    }

    if (toolAllowed(ctx, "searchOrganization")) {
      const orgSearch = await executeTool("searchOrganization", { q }, ctx);
      if (orgSearch.ok) {
        const rows = (orgSearch.data.results as Array<Record<string, string>>) ?? [];
        for (const r of rows) {
          results.push({
            type: r.type,
            title: r.title,
            href: r.href,
            id: r.id,
          });
        }
      }
    }

    return apiSuccess({
      query: q,
      intent: { tools: intent.tools, args: intent.args },
      results,
      asOf: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
