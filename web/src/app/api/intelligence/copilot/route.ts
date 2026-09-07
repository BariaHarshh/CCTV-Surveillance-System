import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { listConversations, runOrchestrator } from "@/lib/intelligence/orchestrator";

export async function GET() {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember(["ADMIN", "STAFF"]);
    const conversations = await listConversations(organizationId, user._id.toString());
    return apiSuccess({
      conversations: conversations.map((c) => ({
        conversationId: c.conversationId,
        title: c.title,
        status: c.status,
        updatedAt: c.updatedAt,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const postSchema = z.object({
  conversationId: z.string().min(1).optional(),
  message: z.string().min(1).max(8000),
  context: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember(["ADMIN", "STAFF"]);
    const parsed = postSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid request body.", 400, "VALIDATION_ERROR");

    const result = await runOrchestrator({
      organizationId,
      user,
      conversationId: parsed.data.conversationId,
      message: parsed.data.message,
      context: parsed.data.context,
    });

    return apiSuccess({ result });
  } catch (error) {
    return handleApiError(error);
  }
}
