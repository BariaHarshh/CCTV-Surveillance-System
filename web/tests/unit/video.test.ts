import { describe, expect, it } from "vitest";
import { fingerprintVideoEvent } from "@/lib/video/pipeline";
import { computePerformanceScore } from "@/lib/video/video-service";
import { createCameraProvider } from "@/lib/video/provider";
import { VIDEO_SENSITIVE_CATEGORIES, DEFAULT_DEDUPE_WINDOW_SEC } from "@/lib/video/constants";

describe("video event fingerprint / dedupe", () => {
  it("groups same camera+type within window", () => {
    const at = new Date("2026-08-25T10:00:00Z");
    const a = fingerprintVideoEvent({
      cameraId: "cam1",
      eventType: "MOTION_EVENT",
      zoneId: "z1",
      windowSec: DEFAULT_DEDUPE_WINDOW_SEC,
      at,
    });
    const b = fingerprintVideoEvent({
      cameraId: "cam1",
      eventType: "MOTION_EVENT",
      zoneId: "z1",
      windowSec: DEFAULT_DEDUPE_WINDOW_SEC,
      at: new Date(at.getTime() + 30_000),
    });
    expect(a).toBe(b);
  });

  it("separates different types or cameras", () => {
    const at = new Date("2026-08-25T10:00:00Z");
    const a = fingerprintVideoEvent({
      cameraId: "cam1",
      eventType: "MOTION_EVENT",
      windowSec: 60,
      at,
    });
    const b = fingerprintVideoEvent({
      cameraId: "cam2",
      eventType: "MOTION_EVENT",
      windowSec: 60,
      at,
    });
    const c = fingerprintVideoEvent({
      cameraId: "cam1",
      eventType: "CAMERA_TAMPERING",
      windowSec: 60,
      at,
    });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("camera performance score", () => {
  it("marks healthy cameras", () => {
    const r = computePerformanceScore({
      status: "ONLINE",
      offlineCount7d: 0,
      avgLatency: 80,
      errorCount7d: 0,
    });
    expect(r.label).toBe("HEALTHY");
    expect(r.score).toBeGreaterThan(80);
    expect(r.factors.length).toBeGreaterThan(0);
  });

  it("marks critical when availability collapses", () => {
    const r = computePerformanceScore({
      status: "OFFLINE",
      offlineCount7d: 12,
      avgLatency: 900,
      errorCount7d: 12,
    });
    expect(r.label).toBe("CRITICAL");
  });
});

describe("camera provider honesty", () => {
  it("demo provider never claims live production stream", async () => {
    const provider = createCameraProvider("HTTP", true);
    await provider.connect({ protocol: "DEMO", streamUrl: "demo://synthetic" });
    const stream = await provider.getStream();
    expect(stream.demo).toBe(true);
    expect(stream.live).toBe(false);
    expect(stream.type).toBe("DEMO");
  });

  it("disconnected provider is offline", async () => {
    const provider = createCameraProvider("HTTP", false);
    const status = await provider.getStatus();
    expect(status.online).toBe(false);
  });
});

describe("sensitive detection defaults", () => {
  it("treats person/crowd as sensitive (off by default in policy)", () => {
    expect(VIDEO_SENSITIVE_CATEGORIES).toContain("PERSON_DETECTED");
    expect(VIDEO_SENSITIVE_CATEGORIES).toContain("CROWD_DETECTED");
  });
});
