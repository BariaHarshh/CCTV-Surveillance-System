import { NextRequest } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { getAIStatus } from "@/lib/intelligence/providers";
import { runOrchestrator } from "@/lib/intelligence/orchestrator";
import { User, type IUser } from "@/models/User";
import { Organization } from "@/models/Organization";
import { connectDB } from "@/lib/db/connect";

const schema = z.object({
  organizationId: z.string().min(1).optional(),
  message: z.string().min(1).max(2000).optional(),
  echoOnly: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const actor = await requireSuperAdmin();
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return apiError("Invalid request body.", 400, "VALIDATION_ERROR");

    const status = getAIStatus();
    if (parsed.data.echoOnly || !parsed.data.organizationId || !parsed.data.message) {
      return apiSuccess({
        mode: "echo",
        status,
        note: "Provide organizationId + message to run a real orchestrator test against that org.",
      });
    }

    if (!mongoose.isValidObjectId(parsed.data.organizationId)) {
      return apiError("Invalid organizationId.", 400, "VALIDATION_ERROR");
    }

    await connectDB();
    const org = await Organization.findOne({
      _id: parsed.data.organizationId,
      deletedAt: null,
    }).lean();
    if (!org) return apiError("Organization not found.", 404, "RESOURCE_NOT_FOUND");

    // Prefer an active ADMIN of the org so tools/privacy run in real org context
    const orgAdmin = await User.findOne({
      organizationId: org._id,
      role: "ADMIN",
      status: "ACTIVE",
    });
    const runner: IUser = orgAdmin
      ? orgAdmin
      : Object.assign(actor, { organizationId: org._id as mongoose.Types.ObjectId });

    const result = await runOrchestrator({
      organizationId: org._id.toString(),
      user: runner,
      message: `[super-admin test] ${parsed.data.message}`,
    });

    return apiSuccess({
      mode: "orchestrator",
      status,
      organization: {
        id: org._id.toString(),
        name: org.basicInformation?.name ?? "Organization",
      },
      result: {
        conversationId: result.conversationId,
        messageId: result.messageId,
        content: result.content,
        mode: result.mode,
        provider: result.provider,
        model: result.model,
        warning: result.warning,
        toolsUsed: result.toolsUsed,
        confidence: result.confidence,
        latencyMs: result.latencyMs,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET() {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    return apiSuccess({ status: getAIStatus() });
  } catch (error) {
    return handleApiError(error);
  }
}
