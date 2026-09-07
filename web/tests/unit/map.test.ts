import { describe, expect, it } from "vitest";
import {
  clusterPoints,
  riskLevelFromScore,
  validateLatLng,
  validatePolygonRing,
  dayPartFromHour,
} from "@/lib/map/geo";
import { suggestEvacuationRoute } from "@/lib/map/routing";
import { redactCoordinates, resolveLocationPrecision } from "@/lib/map/privacy";

describe("geo validation", () => {
  it("rejects invalid coordinates", () => {
    expect(validateLatLng(91, 0).ok).toBe(false);
    expect(validateLatLng(0, 200).ok).toBe(false);
    expect(validateLatLng(12.9, 77.6).ok).toBe(true);
  });

  it("requires closed polygon rings", () => {
    expect(
      validatePolygonRing([
        [0, 0],
        [1, 0],
        [1, 1],
      ]).ok
    ).toBe(false);
    expect(
      validatePolygonRing([
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ]).ok
    ).toBe(true);
  });
});

describe("clustering", () => {
  it("clusters nearby points at low zoom", () => {
    const points = Array.from({ length: 12 }, (_, i) => ({
      id: `i${i}`,
      lat: 12.97 + i * 0.00001,
      lng: 77.59 + i * 0.00001,
    }));
    const clusters = clusterPoints(points, 10);
    expect(clusters.some((c) => c.isCluster)).toBe(true);
    const highZoom = clusterPoints(points, 18);
    expect(highZoom.every((c) => !c.isCluster)).toBe(true);
  });
});

describe("risk scoring", () => {
  it("returns insufficient data for small samples", () => {
    expect(riskLevelFromScore(90, 1)).toBe("INSUFFICIENT_DATA");
    expect(riskLevelFromScore(90, 5)).toBe("CRITICAL");
    expect(riskLevelFromScore(10, 5)).toBe("LOW");
  });

  it("maps day parts", () => {
    expect(dayPartFromHour(8)).toBe("MORNING");
    expect(dayPartFromHour(22)).toBe("NIGHT");
  });
});

describe("routing honesty", () => {
  it("does not fabricate routes without graph data", () => {
    const result = suggestEvacuationRoute({
      start: { lat: 1, lng: 1 },
      destination: { lat: 2, lng: 2 },
      nodes: [],
      edges: [],
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/cannot be reliably calculated/i);
    expect(result.isRecommendation).toBe(true);
  });

  it("computes route when graph is complete", () => {
    const result = suggestEvacuationRoute({
      start: { lat: 0, lng: 0 },
      destination: { lat: 1, lng: 1 },
      nodes: [
        { id: "a", lat: 0, lng: 0, kind: "START" },
        { id: "b", lat: 1, lng: 1, kind: "EXIT" },
      ],
      edges: [{ from: "a", to: "b", lengthM: 100 }],
    });
    expect(result.ok).toBe(true);
    expect(result.path.length).toBe(2);
  });
});

describe("location privacy", () => {
  it("hides team locations without permission", () => {
    const precision = resolveLocationPrecision(
      { role: "STAFF", permissions: ["campus:view"] },
      "team"
    );
    expect(precision).toBe("HIDDEN");
    expect(redactCoordinates(12.97, 77.59, "HIDDEN")).toEqual({
      lat: null,
      lng: null,
      redacted: true,
    });
  });

  it("allows admins exact coordinates", () => {
    const precision = resolveLocationPrecision({ role: "ADMIN", permissions: [] }, "exit");
    expect(precision).toBe("EXACT");
  });
});
