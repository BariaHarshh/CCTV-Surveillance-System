import mongoose from "mongoose";

export interface AnalyticsFilters {
  from?: string;
  to?: string;
  campusId?: string;
  buildingId?: string;
  floor?: string;
  roomId?: string;
  cameraId?: string;
  eventType?: string;
  severity?: string;
  incidentStatus?: string;
  emergencyType?: string;
  granularity?: "day" | "week" | "month";
  compare?: "previous" | "yoy";
  includeTest?: boolean;
}

export function parseAnalyticsFilters(params: URLSearchParams | Record<string, string | undefined>): AnalyticsFilters {
  const get = (k: string) =>
    params instanceof URLSearchParams ? params.get(k) ?? undefined : params[k];
  return {
    from: get("from") ?? undefined,
    to: get("to") ?? undefined,
    campusId: get("campusId") ?? undefined,
    buildingId: get("buildingId") ?? undefined,
    floor: get("floor") ?? undefined,
    roomId: get("roomId") ?? undefined,
    cameraId: get("cameraId") ?? undefined,
    eventType: get("eventType") ?? undefined,
    severity: get("severity") ?? undefined,
    incidentStatus: get("incidentStatus") ?? undefined,
    emergencyType: get("emergencyType") ?? undefined,
    granularity: (get("granularity") as AnalyticsFilters["granularity"]) ?? "day",
    compare: (get("compare") as AnalyticsFilters["compare"]) ?? undefined,
    includeTest: get("includeTest") === "true",
  };
}

export function dateRange(filters: AnalyticsFilters): { from: Date; to: Date } {
  const to = filters.to ? new Date(filters.to) : new Date();
  to.setHours(23, 59, 59, 999);
  const from = filters.from ? new Date(filters.from) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

export function previousPeriod(from: Date, to: Date): { from: Date; to: Date } {
  const ms = to.getTime() - from.getTime();
  return { from: new Date(from.getTime() - ms - 1), to: new Date(from.getTime() - 1) };
}

export function orgId(organizationId: string) {
  return new mongoose.Types.ObjectId(organizationId);
}

/** Base match that always excludes TEST unless explicitly included */
export function baseMatch(organizationId: string, filters: AnalyticsFilters, dateField = "createdAt") {
  const { from, to } = dateRange(filters);
  const match: Record<string, unknown> = {
    organizationId: orgId(organizationId),
    [dateField]: { $gte: from, $lte: to },
  };
  if (!filters.includeTest) match.source = { $ne: "TEST" as const };
  if (filters.severity) match.severity = filters.severity;
  if (filters.cameraId && mongoose.Types.ObjectId.isValid(filters.cameraId)) {
    match.cameraId = orgId(filters.cameraId);
  }
  if (filters.eventType) match.eventType = filters.eventType;
  if (filters.incidentStatus) match.status = filters.incidentStatus;
  if (filters.emergencyType) match.type = filters.emergencyType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return match as any;
}

export function emptyState(message = "No data available for this period.") {
  return { empty: true as const, message };
}

export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stdDev(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values)!;
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
