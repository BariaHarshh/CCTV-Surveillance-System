/**
 * Step 17 — Enterprise BI / Executive Intelligence constants.
 * Extends existing analytics-service — does not replace it.
 */

export const KPI_CATEGORIES = [
  "SAFETY",
  "SECURITY",
  "OPERATIONS",
  "INCIDENTS",
  "EMERGENCY",
  "CAMERAS",
  "RESPONSE",
  "FACILITIES",
  "COMPLIANCE",
  "AI",
  "FINANCIAL",
  "SYSTEM_HEALTH",
] as const;
export type KpiCategory = (typeof KPI_CATEGORIES)[number];

export const KPI_STATUSES = ["EXCELLENT", "GOOD", "ATTENTION", "CRITICAL", "NO_DATA"] as const;
export type KpiStatus = (typeof KPI_STATUSES)[number];

export const KPI_TRENDS = ["IMPROVING", "STABLE", "DECLINING", "INSUFFICIENT_DATA"] as const;

export const KPI_PERIODS = ["TODAY", "7D", "30D", "90D", "QUARTER", "YEAR", "CUSTOM"] as const;

export const INITIATIVE_STATUSES = [
  "NOT_STARTED",
  "ON_TRACK",
  "AT_RISK",
  "DELAYED",
  "COMPLETED",
] as const;

export const DECISION_STATUSES = ["OPEN", "APPROVED", "CLOSED", "CANCELLED"] as const;

export const DATA_CLASSIFICATIONS = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"] as const;

export const POLICY_COMPLIANCE_STATES = ["COMPLIANT", "ATTENTION", "VIOLATION", "UNKNOWN"] as const;

export const FORECAST_CONFIDENCE = ["HIGH", "MEDIUM", "LOW", "UNAVAILABLE"] as const;

export const DATA_FRESHNESS = ["LIVE", "RECENT", "DELAYED"] as const;

export const MIN_POINTS_FOR_FORECAST = 5;
export const MIN_POINTS_FOR_BENCHMARK = 2;

export function newBiId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function kpiStatusFromValue(
  value: number | null,
  target: number | null,
  warning: number | null,
  critical: number | null,
  higherIsBetter: boolean
): KpiStatus {
  if (value == null || Number.isNaN(value)) return "NO_DATA";
  if (critical != null) {
    const breached = higherIsBetter ? value <= critical : value >= critical;
    if (breached) return "CRITICAL";
  }
  if (warning != null) {
    const warn = higherIsBetter ? value <= warning : value >= warning;
    if (warn) return "ATTENTION";
  }
  if (target != null) {
    const met = higherIsBetter ? value >= target : value <= target;
    if (met) return "EXCELLENT";
    return "GOOD";
  }
  return "GOOD";
}

/** Linear forecast from historical series — estimate only, never presented as fact. */
export function forecastSeries(values: number[]): {
  next: number | null;
  low: number | null;
  high: number | null;
  confidence: (typeof FORECAST_CONFIDENCE)[number];
  disclaimer: string;
} {
  const disclaimer =
    "Forecasts are estimates based on historical system data and should not be treated as guarantees.";
  if (values.length < MIN_POINTS_FOR_FORECAST) {
    return {
      next: null,
      low: null,
      high: null,
      confidence: "UNAVAILABLE",
      disclaimer: "Forecast unavailable — insufficient historical data.",
    };
  }
  const n = values.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const next = intercept + slope * n;
  const residuals = values.map((y, i) => y - (intercept + slope * i));
  const variance = residuals.reduce((s, r) => s + r * r, 0) / n;
  const std = Math.sqrt(variance);
  const confidence =
    n >= 12 && std / (Math.abs(next) + 1) < 0.25
      ? "HIGH"
      : n >= 8
        ? "MEDIUM"
        : "LOW";
  return {
    next: Math.round(next * 10) / 10,
    low: Math.round((next - 1.64 * std) * 10) / 10,
    high: Math.round((next + 1.64 * std) * 10) / 10,
    confidence,
    disclaimer,
  };
}
