import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { checkRateLimit, getClientIp } from "@/lib/auth/rate-limit";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { inquiryCreateSchema } from "@/lib/inquiries/schemas";
import { createInquiry } from "@/lib/inquiries/service";

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();

    const ip = getClientIp(request);
    const limit = checkRateLimit(`inquiry:${ip}`, 5, 15 * 60 * 1000);
    if (!limit.allowed) {
      return apiError(
        "Too many requests. Please try again later.",
        429,
        "RATE_LIMITED",
        { retryAfterSeconds: limit.retryAfterSeconds }
      );
    }

    const parsed = inquiryCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid input.", 400, "VALIDATION_ERROR");
    }

    const inquiry = await createInquiry({
      ...parsed.data,
      ipAddress: ip,
      userAgent: request.headers.get("user-agent") ?? "",
    });

    await logAuditEvent({
      action: "INQUIRY_RECEIVED",
      description: `Purchase interest received from ${inquiry.name} (${inquiry.organizationName})`,
      request,
      targetType: "PurchaseInquiry",
      targetId: inquiry.id,
      targetLabel: inquiry.inquiryId,
      severity: "info",
      metadata: {
        inquiryId: inquiry.inquiryId,
        email: inquiry.email,
        organizationName: inquiry.organizationName,
      },
    });

    return apiSuccess(
      {
        success: true,
        inquiryId: inquiry.inquiryId,
        message: "Thank you. Your requirements have been sent to our team.",
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
