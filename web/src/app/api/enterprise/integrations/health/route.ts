import mongoose from "mongoose";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getAIStatus } from "@/lib/intelligence/providers";
import { ApiKey, WebhookEndpoint } from "@/models/Platform";

export async function GET() {
  try {
    await ensureDbReady();
    const { organizationId } = await requireOrgMember(["ADMIN"]);
    const oid = new mongoose.Types.ObjectId(organizationId);

    const [apiKeys, webhooks] = await Promise.all([
      ApiKey.countDocuments({ organizationId: oid, revokedAt: null }),
      WebhookEndpoint.countDocuments({ organizationId: oid, enabled: true }),
    ]);

    const ai = getAIStatus();
    const emailConfigured =
      Boolean(process.env.EMAIL_PROVIDER) && process.env.EMAIL_PROVIDER !== "CONSOLE";

    const integrations = [
      {
        key: "api_keys",
        name: "API Keys",
        status: apiKeys > 0 ? "CONNECTED" : "NOT_CONFIGURED",
      },
      {
        key: "webhooks",
        name: "Webhooks",
        status: webhooks > 0 ? "CONNECTED" : "NOT_CONFIGURED",
      },
      {
        key: "email",
        name: "Email / Notifications",
        status: emailConfigured ? "CONNECTED" : "NOT_CONFIGURED",
      },
      {
        key: "ai",
        name: "AI Provider",
        status: ai.available ? "CONNECTED" : "NOT_CONFIGURED",
      },
      {
        key: "storage",
        name: "Object Storage",
        status: process.env.STORAGE_URL ? "CONNECTED" : "NOT_CONFIGURED",
      },
      {
        key: "redis",
        name: "Cache / Queue",
        status: process.env.REDIS_URL ? "CONNECTED" : "NOT_CONFIGURED",
      },
    ];

    return apiSuccess({ integrations });
  } catch (error) {
    return handleApiError(error);
  }
}
