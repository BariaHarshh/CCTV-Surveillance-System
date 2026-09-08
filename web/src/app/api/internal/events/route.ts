import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { validateInternalEventRequest } from "@/lib/monitoring/internal-auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { createEvent } from "@/lib/monitoring/event-service";
import { EVENT_TYPES } from "@/lib/monitoring/constants";
import { logAuditEvent } from "@/lib/audit/log";

const schema = z.object({
  organizationId: z.string().min(1),
  cameraId: z.string().optional().nullable(),
  eventType: z.enum(EVENT_TYPES),
  confidence: z.number().min(0).max(1).nullable().optional(),
  source: z.enum(["DETECTION", "SYSTEM", "TEST", "MANUAL"]).default("DETECTION"),
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

    const result = await createEvent({
      organizationId: parsed.data.organizationId,
      cameraId: parsed.data.cameraId,
      eventType: parsed.data.eventType,
      confidence: parsed.data.confidence ?? null,
      source: parsed.data.source,
      metadata: parsed.data.metadata,
    });

    await logAuditEvent({
      action: "EVENT_CREATED",
      description: `Internal event ingested: ${result.event.eventId}`,
      request,
      targetType: "Event",
      targetLabel: result.event.eventId,
      metadata: { organizationId: parsed.data.organizationId, source: "internal" },
    });

    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
