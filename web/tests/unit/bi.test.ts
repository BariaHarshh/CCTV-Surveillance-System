import { describe, expect, it } from "vitest";
import {
  forecastSeries,
  kpiStatusFromValue,
  MIN_POINTS_FOR_FORECAST,
} from "@/lib/bi/constants";
import { percentChange } from "@/lib/analytics/constants";

describe("KPI status engine", () => {
  it("returns NO_DATA when value missing", () => {
    expect(kpiStatusFromValue(null, 80, 60, 40, true)).toBe("NO_DATA");
  });

  it("marks critical when threshold breached (higher is better)", () => {
    expect(kpiStatusFromValue(30, 80, 60, 40, true)).toBe("CRITICAL");
  });

  it("marks excellent when target met", () => {
    expect(kpiStatusFromValue(95, 80, 60, 40, true)).toBe("EXCELLENT");
  });

  it("handles lower-is-better metrics (response time)", () => {
    expect(kpiStatusFromValue(1500, 300, 600, 1200, false)).toBe("CRITICAL");
    expect(kpiStatusFromValue(200, 300, 600, 1200, false)).toBe("EXCELLENT");
  });
});

describe("analytics accuracy formulas", () => {
  it("computes critical rate", () => {
    const total = 100;
    const critical = 20;
    expect(Math.round((critical / total) * 100)).toBe(20);
  });

  it("computes percent change", () => {
    expect(percentChange(42, 51)).toBe(-17.6);
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(5, 0)).toBe(null);
  });
});

describe("forecast honesty", () => {
  it("refuses forecast without enough points", () => {
    const f = forecastSeries([1, 2, 3]);
    expect(f.confidence).toBe("UNAVAILABLE");
    expect(f.next).toBeNull();
    expect(f.disclaimer.toLowerCase()).toContain("insufficient");
  });

  it("returns labeled estimate with enough history", () => {
    const values = Array.from({ length: MIN_POINTS_FOR_FORECAST + 3 }, (_, i) => 10 + i);
    const f = forecastSeries(values);
    expect(f.next).not.toBeNull();
    expect(["HIGH", "MEDIUM", "LOW"]).toContain(f.confidence);
    expect(f.disclaimer).toContain("should not be treated as guarantees");
  });
});
