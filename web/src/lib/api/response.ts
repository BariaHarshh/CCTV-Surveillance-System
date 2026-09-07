import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/session";
import { OrgIsolationError } from "@/lib/campus/service";
import { FeatureGateError, PlanLimitError } from "@/lib/platform/billing-service";
import { getRequestId } from "@/lib/platform/logging";

export function apiSuccess<T extends Record<string, unknown>>(data: T, status = 200) {
  return NextResponse.json({ success: true, requestId: getRequestId(), ...data }, { status });
}

export function apiError(
  message: string,
  status: number,
  code?: string,
  extra?: Record<string, unknown>
) {
  const requestId = getRequestId();
  return NextResponse.json(
    {
      success: false,
      // Keep string `error` for existing clients; also provide structured object.
      error: message,
      code: code ?? "INTERNAL_ERROR",
      requestId,
      details: {
        code: code ?? "INTERNAL_ERROR",
        message,
        requestId,
      },
      ...extra,
    },
    { status }
  );
}

export function handleApiError(error: unknown) {
  if (error instanceof AuthError) {
    return apiError(
      error.message,
      error.code === "UNAUTHORIZED" ? 401 : 403,
      error.code === "UNAUTHORIZED" ? "AUTH_REQUIRED" : "PERMISSION_DENIED"
    );
  }

  if (error instanceof OrgIsolationError) {
    return apiError("Access denied.", 403, "PERMISSION_DENIED");
  }

  if (error instanceof PlanLimitError) {
    return apiError(error.message, 402, "PLAN_LIMIT_REACHED");
  }

  if (error instanceof FeatureGateError) {
    return apiError(error.message, 403, "FEATURE_NOT_AVAILABLE");
  }

  if (error instanceof Error && error.message.includes("not found")) {
    return apiError(error.message, 404, "RESOURCE_NOT_FOUND");
  }

  if (
    error instanceof Error &&
    (error.message.includes("already exists") || error.message.includes("already registered"))
  ) {
    return apiError(error.message, 409, "VALIDATION_ERROR");
  }

  console.error("[API Error]", error);

  if (error instanceof Error && error.message.includes("MongoServerSelectionError")) {
    return apiError(
      "Service temporarily unavailable. Please try again later.",
      503,
      "SERVICE_UNAVAILABLE"
    );
  }

  const isProd = process.env.NODE_ENV === "production";
  return apiError(
    isProd
      ? "An unexpected error occurred. Please try again."
      : error instanceof Error
        ? error.message
        : "Unexpected error",
    500,
    "INTERNAL_ERROR"
  );
}
