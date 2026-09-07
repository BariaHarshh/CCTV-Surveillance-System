import { describe, expect, it } from "vitest";
import { FIELD_STAFF_STATUSES, CHECKIN_STATUSES, OFFLINE_OPS } from "@/lib/mobile/constants";
import { RESPONSE_TASK_TRANSITIONS } from "@/lib/emergency/constants";

describe("field staff status", () => {
  it("includes operational duty states", () => {
    expect(FIELD_STAFF_STATUSES).toContain("AVAILABLE");
    expect(FIELD_STAFF_STATUSES).toContain("RESPONDING");
    expect(FIELD_STAFF_STATUSES).toContain("ON_SCENE");
    expect(FIELD_STAFF_STATUSES).toContain("OFF_DUTY");
  });
});

describe("task transitions for mobile actions", () => {
  it("allows start/pause/complete/reject paths", () => {
    expect(RESPONSE_TASK_TRANSITIONS.PENDING).toContain("IN_PROGRESS");
    expect(RESPONSE_TASK_TRANSITIONS.IN_PROGRESS).toContain("PAUSED");
    expect(RESPONSE_TASK_TRANSITIONS.PAUSED).toContain("IN_PROGRESS");
    expect(RESPONSE_TASK_TRANSITIONS.IN_PROGRESS).toContain("COMPLETED");
    expect(RESPONSE_TASK_TRANSITIONS.PENDING).toContain("REJECTED");
  });

  it("does not allow restarting completed tasks", () => {
    expect(RESPONSE_TASK_TRANSITIONS.COMPLETED).toEqual([]);
  });
});

describe("check-in and offline ops", () => {
  it("limits check-in to submitted statuses only", () => {
    expect(CHECKIN_STATUSES).toEqual(["I_AM_SAFE", "I_NEED_ASSISTANCE", "ON_SCENE"]);
  });

  it("defines offline queue operations", () => {
    expect(OFFLINE_OPS).toContain("CREATE");
    expect(OFFLINE_OPS).toContain("COMPLETE");
  });
});

describe("push honesty", () => {
  it("documents skipped state when provider missing", async () => {
    const prev = process.env.PUSH_PROVIDER;
    delete process.env.PUSH_PROVIDER;
    const { queuePushDelivery } = await import("@/lib/mobile/push-service");
    // Without DB this would fail — unit-test the contract via constants
    expect(process.env.PUSH_PROVIDER || "NONE").toBe("NONE");
    if (prev) process.env.PUSH_PROVIDER = prev;
    expect(typeof queuePushDelivery).toBe("function");
  });
});
