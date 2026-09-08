import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { inquiryStatusSchema } from "@/lib/inquiries/schemas";
import { getInquiryById, updateInquiryStatus } from "@/lib/inquiries/service";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const actor = await requireSuperAdmin();
    const { id } = await params;
    const inquiry = await getInquiryById(id);
    if (!inquiry) return apiError("Inquiry not found.", 404, "NOT_FOUND");

    await logAuditEvent({
      actor,
      action: "INQUIRY_VIEWED",
      description: `${actor.name} viewed inquiry ${inquiry.inquiryId}`,
      request,
      targetType: "PurchaseInquiry",
      targetId: id,
      targetLabel: inquiry.inquiryId,
    });

    return apiSuccess({ inquiry });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const actor = await requireSuperAdmin();
    const { id } = await params;
    const parsed = inquiryStatusSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid status.", 400, "VALIDATION_ERROR");
    }

    const inquiry = await updateInquiryStatus(id, parsed.data.status, parsed.data.notes);
    if (!inquiry) return apiError("Inquiry not found.", 404, "NOT_FOUND");

    await logAuditEvent({
      actor,
      action: "INQUIRY_STATUS_CHANGED",
      description: `${actor.name} updated inquiry ${inquiry.inquiryId} to ${inquiry.status}`,
      request,
      targetType: "PurchaseInquiry",
      targetId: id,
      targetLabel: inquiry.inquiryId,
      metadata: { status: inquiry.status },
    });

    return apiSuccess({ inquiry });
  } catch (error) {
    return handleApiError(error);
  }
}
