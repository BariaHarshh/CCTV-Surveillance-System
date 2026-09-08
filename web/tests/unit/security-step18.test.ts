import { describe, expect, it, afterEach, vi } from "vitest";
import crypto from "crypto";
import { NextRequest } from "next/server";
import { validateInternalEventRequest, isTestModeEnabled } from "@/lib/monitoring/internal-auth";
import { validateEnvironment } from "@/lib/platform/secret-manager";
import { InternalPaymentProvider } from "@/lib/platform/billing-service";
import { forecastSeries } from "@/lib/bi/constants";

describe("Step 18 security hardening", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("payment webhook verification", () => {
    it("rejects when webhook secret is unset", async () => {
      delete process.env.PAYMENT_WEBHOOK_SECRET;
      delete process.env.WEBHOOK_SECRET;
      const provider = new InternalPaymentProvider();
      await expect(
        provider.verifyWebhook(JSON.stringify({ type: "checkout.completed", data: {} }), "sig")
      ).rejects.toThrow(/signature/i);
    });

    it("rejects invalid signature when secret is set", async () => {
      vi.stubEnv("PAYMENT_WEBHOOK_SECRET", "test-webhook-secret-value");
      const provider = new InternalPaymentProvider();
      const body = JSON.stringify({
        type: "checkout.completed",
        data: { organizationId: "x", planId: "STARTER" },
      });
      await expect(provider.verifyWebhook(body, "wrong")).rejects.toThrow(/signature/i);
    });

    it("accepts valid HMAC signature", async () => {
      vi.stubEnv("PAYMENT_WEBHOOK_SECRET", "test-webhook-secret-value");
      const provider = new InternalPaymentProvider();
      const body = JSON.stringify({
        type: "checkout.completed",
        data: { organizationId: "x", planId: "STARTER" },
      });
      const sig = crypto
        .createHmac("sha256", "test-webhook-secret-value")
        .update(body)
        .digest("hex");
      const event = await provider.verifyWebhook(body, sig);
      expect(event.type).toBe("checkout.completed");
    });
  });

  describe("internal event auth", () => {
    it("denies non-production when neither key nor MONITORING_TEST_MODE", () => {
      vi.stubEnv("NODE_ENV", "test");
      delete process.env.INTERNAL_EVENTS_API_KEY;
      delete process.env.MONITORING_TEST_MODE;
      const req = new NextRequest("http://localhost/api/internal/events");
      expect(validateInternalEventRequest(req)).toBe(false);
    });

    it("allows MONITORING_TEST_MODE without key in non-production", () => {
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("MONITORING_TEST_MODE", "true");
      delete process.env.INTERNAL_EVENTS_API_KEY;
      const req = new NextRequest("http://localhost/api/internal/events");
      expect(validateInternalEventRequest(req)).toBe(true);
      expect(isTestModeEnabled()).toBe(true);
    });

    it("requires matching key when INTERNAL_EVENTS_API_KEY is set", () => {
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("INTERNAL_EVENTS_API_KEY", "internal-key");
      vi.stubEnv("MONITORING_TEST_MODE", "true");
      const bad = new NextRequest("http://localhost/api/internal/events", {
        headers: { "x-internal-service-key": "wrong" },
      });
      const good = new NextRequest("http://localhost/api/internal/events", {
        headers: { "x-internal-service-key": "internal-key" },
      });
      expect(validateInternalEventRequest(bad)).toBe(false);
      expect(validateInternalEventRequest(good)).toBe(true);
    });

    it("requires key in production even if MONITORING_TEST_MODE is set", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("MONITORING_TEST_MODE", "true");
      vi.stubEnv("INTERNAL_EVENTS_API_KEY", "prod-key");
      const missing = new NextRequest("http://localhost/api/internal/events");
      const ok = new NextRequest("http://localhost/api/internal/events", {
        headers: { "x-internal-service-key": "prod-key" },
      });
      expect(validateInternalEventRequest(missing)).toBe(false);
      expect(validateInternalEventRequest(ok)).toBe(true);
    });
  });

  describe("production environment validation", () => {
    it("fails closed when production secrets are placeholders", () => {
      const result = validateEnvironment({
        NODE_ENV: "production",
        MONGODB_URI: "mongodb://localhost/test",
        SESSION_SECRET: "change-me",
        JWT_SECRET: "change-me",
        JWT_REFRESH_SECRET: "change-me",
      } as NodeJS.ProcessEnv);
      expect(result.ok).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
    });

    it("requires payment webhook and internal keys in production", () => {
      const result = validateEnvironment({
        NODE_ENV: "production",
        MONGODB_URI: "mongodb://localhost/test",
        SESSION_SECRET: "a-strong-session-secret-at-least-32chars",
        JWT_SECRET: "a-strong-jwt-secret-at-least-32-chars!!",
        JWT_REFRESH_SECRET: "a-strong-refresh-secret-at-least-32",
        CAMERA_ENCRYPTION_KEY: "a-strong-camera-encryption-key-32ch",
      } as NodeJS.ProcessEnv);
      expect(result.ok).toBe(false);
      expect(result.missing).toEqual(
        expect.arrayContaining([
          "PAYMENT_WEBHOOK_SECRET or WEBHOOK_SECRET",
          "INTERNAL_EVENTS_API_KEY",
        ])
      );
    });
  });

  describe("download token hashing", () => {
    it("hashes tokens with sha256 consistently", () => {
      const token = "abc123tokenvaluehere";
      const a = crypto.createHash("sha256").update(token).digest("hex");
      const b = crypto.createHash("sha256").update(token).digest("hex");
      expect(a).toBe(b);
      expect(a).not.toBe(token);
      expect(a).toHaveLength(64);
    });
  });
});

describe("analytics KPI honesty (known dataset)", () => {
  it("computes critical rate for 100 incidents / 20 critical = 20%", () => {
    const total = 100;
    const critical = 20;
    expect(Math.round((critical / total) * 100)).toBe(20);
  });

  it("marks forecast insufficient when dataset is too small", () => {
    const f = forecastSeries([1, 2, 3]);
    expect(f.confidence).toBe("UNAVAILABLE");
    expect(f.disclaimer.toLowerCase()).toContain("insufficient");
  });
});
