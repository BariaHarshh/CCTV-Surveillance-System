import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { getOrCreatePrivacy } from "@/lib/intelligence/orchestrator";

export async function GET() {
  try {
    await ensureDbReady();
    const { organizationId } = await requireOrgMember(["ADMIN", "STAFF"]);
    const privacy = await getOrCreatePrivacy(organizationId);
    return apiSuccess({
      privacy: {
        aiEnabled: privacy.aiEnabled,
        copilotEnabled: privacy.copilotEnabled,
        knowledgeBaseEnabled: privacy.knowledgeBaseEnabled,
        allowExternalProviders: privacy.allowExternalProviders,
        conversationRetentionDays: privacy.conversationRetentionDays,
        documentIndexingEnabled: privacy.documentIndexingEnabled,
        trainingUsageAllowed: privacy.trainingUsageAllowed,
        redactionEnabled: privacy.redactionEnabled,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  aiEnabled: z.boolean().optional(),
  copilotEnabled: z.boolean().optional(),
  knowledgeBaseEnabled: z.boolean().optional(),
  allowExternalProviders: z.boolean().optional(),
  conversationRetentionDays: z.number().int().min(7).max(365).optional(),
  documentIndexingEnabled: z.boolean().optional(),
  trainingUsageAllowed: z.boolean().optional(),
  redactionEnabled: z.boolean().optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    await ensureDbReady();
    const { organizationId } = await requireOrgMember(["ADMIN"]);
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid request body.", 400, "VALIDATION_ERROR");

    const privacy = await getOrCreatePrivacy(organizationId);
    Object.assign(privacy, parsed.data);
    await privacy.save();

    return apiSuccess({
      privacy: {
        aiEnabled: privacy.aiEnabled,
        copilotEnabled: privacy.copilotEnabled,
        knowledgeBaseEnabled: privacy.knowledgeBaseEnabled,
        allowExternalProviders: privacy.allowExternalProviders,
        conversationRetentionDays: privacy.conversationRetentionDays,
        documentIndexingEnabled: privacy.documentIndexingEnabled,
        trainingUsageAllowed: privacy.trainingUsageAllowed,
        redactionEnabled: privacy.redactionEnabled,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
