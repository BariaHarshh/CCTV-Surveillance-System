import { describe, expect, it } from "vitest";
import { DEFAULT_PLAN_LIMITS } from "@/lib/platform/constants";
import { validateEnvironment } from "@/lib/platform/secret-manager";
import { hashToken } from "@/models/Platform";
import { signWebhookPayload } from "@/lib/platform/api-webhook-service";

describe("plan limits", () => {
  it("defines FREE and ENTERPRISE features", () => {
    expect(DEFAULT_PLAN_LIMITS.FREE.maxCameras).toBeGreaterThan(0);
    expect(DEFAULT_PLAN_LIMITS.ENTERPRISE.features).toContain("api_access");
  });
});

describe("env validation", () => {
  it("fails closed in production when secrets missing", () => {
    const result = validateEnvironment({ NODE_ENV: "production" });
    expect(result.ok).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
  });
});

describe("token hashing", () => {
  it("hashes consistently", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abcd"));
  });
});

describe("webhook signatures", () => {
  it("signs payload with timestamp", () => {
    const sig = signWebhookPayload("secret", "{\"a\":1}", 1700000000);
    expect(sig).toHaveLength(64);
  });
});

describe("Camera ID handling in getOrCreateCameraAIConfig", () => {
  it("validates mongoose.Types.ObjectId.isValid on human-readable IDs", async () => {
    const mongoose = (await import("mongoose")).default;
    expect(mongoose.Types.ObjectId.isValid("CAM-000002")).toBe(false);
  });
});
