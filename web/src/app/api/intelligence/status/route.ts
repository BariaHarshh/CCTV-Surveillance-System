import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getAIStatus } from "@/lib/intelligence/providers";
import { getOrCreatePrivacy } from "@/lib/intelligence/orchestrator";
import { Organization } from "@/models/Organization";
import { connectDB } from "@/lib/db/connect";

export async function GET() {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember(["ADMIN", "STAFF"]);
    const status = getAIStatus();
    const privacy = await getOrCreatePrivacy(organizationId);
    await connectDB();
    const org = await Organization.findById(organizationId).select("basicInformation.name").lean();

    return apiSuccess({
      status: {
        ...status,
        effectiveMode:
          status.available && privacy.allowExternalProviders && privacy.aiEnabled && privacy.copilotEnabled
            ? "llm"
            : "tools",
      },
      privacy: {
        aiEnabled: privacy.aiEnabled,
        copilotEnabled: privacy.copilotEnabled,
        knowledgeBaseEnabled: privacy.knowledgeBaseEnabled,
        allowExternalProviders: privacy.allowExternalProviders,
        redactionEnabled: privacy.redactionEnabled,
      },
      organization: {
        id: organizationId,
        name: org?.basicInformation?.name ?? "Organization",
      },
      user: {
        role: user.role,
        name: user.name,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
