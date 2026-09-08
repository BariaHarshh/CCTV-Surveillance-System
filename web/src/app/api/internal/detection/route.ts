import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { validateInternalEventRequest } from "@/lib/monitoring/internal-auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { processDetection } from "@/lib/ai/detection-service";
import { AI_MODULE_TYPES } from "@/lib/ai/constants";
import { logAuditEvent } from "@/lib/audit/log";

const schema = z.object({
  organizationId: z.string().min(1),
  cameraId: z.string().min(1),
  moduleType: z.enum(AI_MODULE_TYPES),
  confidence: z.number().min(0).max(1).nullable().optional(),
  source: z.enum(["DETECTION", "TEST"]).default("DETECTION"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    if (!validateInternalEventRequest(request)) {
      return apiError("Forbidden.", 403, "FORBIDDEN");
    }

    await ensureDbReady();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid payload.", 400, "VALIDATION_ERROR");
    }

    const result = await processDetection({
      organizationId: parsed.data.organizationId,
      cameraId: parsed.data.cameraId,
      moduleType: parsed.data.moduleType,
      confidence: parsed.data.confidence ?? null,
      source: parsed.data.source,
      metadata: parsed.data.metadata,
    });

    if ("skipped" in result && result.skipped) {
      return apiSuccess({ skipped: true, reason: result.reason });
    }

    await logAuditEvent({
      action: "DETECTION_CREATED",
      description: `Detection processed: ${parsed.data.moduleType}`,
      request,
      metadata: { organizationId: parsed.data.organizationId, moduleType: parsed.data.moduleType },
    });

    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
