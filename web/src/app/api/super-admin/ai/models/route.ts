import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getAIStatus, getConfiguredProvider } from "@/lib/intelligence/providers";
import { connectDB } from "@/lib/db/connect";
import { AIModelRegistry } from "@/models/AIModelRegistry";
import { VideoModelDeployment } from "@/models/Video";

export async function GET() {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    const status = getAIStatus();
    const provider = getConfiguredProvider();
    await connectDB();
    const [registry, deployments] = await Promise.all([
      AIModelRegistry.find().sort({ name: 1 }).limit(50),
      VideoModelDeployment.find().sort({ updatedAt: -1 }).limit(50),
    ]);

    return apiSuccess({
      models: {
        configuredProvider: status.provider,
        available: status.available,
        mode: status.mode,
        model: status.model,
        baseUrlConfigured: Boolean(process.env.AI_BASE_URL),
        keyConfigured: Boolean(process.env.AI_PROVIDER_KEY || process.env.OPENAI_API_KEY),
        message: status.message,
        env: {
          AI_PROVIDER: process.env.AI_PROVIDER ?? "NONE",
          AI_MODEL: process.env.AI_MODEL ?? null,
          AI_BASE_URL: process.env.AI_BASE_URL ? "[configured]" : null,
          AI_PROVIDER_KEY: provider.available() ? "[configured]" : null,
        },
      },
      registry: registry.map((m) => ({
        modelId: m.modelId,
        name: m.name,
        version: m.version,
        provider: m.provider,
        status: m.status,
        capabilities: m.capabilities,
      })),
      videoDeployments: deployments.map((d) => ({
        deploymentId: d.deploymentId,
        modelId: d.modelId,
        version: d.version,
        lifecycle: d.lifecycle,
        metrics: d.metrics,
        purpose: d.purpose,
        deployedAt: d.deployedAt?.toISOString() ?? null,
      })),
      note: "CV model lifecycle: DRAFT → TESTING → APPROVED → DEPLOYED. Never skip evaluation.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
