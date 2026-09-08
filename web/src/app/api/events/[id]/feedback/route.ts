import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canSubmitEventFeedback } from "@/lib/ai/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { submitEventFeedback } from "@/lib/ai/feedback-service";
import { FEEDBACK_TYPES } from "@/lib/ai/constants";

type RouteParams = { params: Promise<{ id: string }> };

const schema = z.object({
  feedbackType: z.enum(FEEDBACK_TYPES),
  reason: z.string().max(1000).optional(),
  useful: z.boolean().nullable().optional(),
});

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canSubmitEventFeedback(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid feedback.", 400, "VALIDATION_ERROR");

    const feedback = await submitEventFeedback(organizationId, id, {
      id: user._id.toString(),
      name: user.name,
    }, parsed.data);

    if (!feedback) return apiError("Event not found.", 404, "NOT_FOUND");

    await logAuditEvent({
      actor: user,
      action: "DETECTION_FEEDBACK_CREATED",
      description: `${user.name} submitted ${parsed.data.feedbackType} feedback on event ${id}`,
      request,
      targetType: "Event",
      targetId: id,
      metadata: { feedbackType: parsed.data.feedbackType },
    });

    return apiSuccess({ feedback }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
