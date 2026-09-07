import { NextRequest } from "next/server";

/**
 * Fail closed: production always requires INTERNAL_EVENTS_API_KEY.
 * Non-production requires the key when configured; otherwise only MONITORING_TEST_MODE=true.
 */
export function validateInternalEventRequest(request: NextRequest): boolean {
  const key = request.headers.get("x-internal-service-key");
  const expected = process.env.INTERNAL_EVENTS_API_KEY;
  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    if (!expected || !key || key !== expected) return false;
    return true;
  }

  if (expected) {
    return Boolean(key) && key === expected;
  }

  return process.env.MONITORING_TEST_MODE === "true";
}

export function isTestModeEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.MONITORING_TEST_MODE === "true";
}
