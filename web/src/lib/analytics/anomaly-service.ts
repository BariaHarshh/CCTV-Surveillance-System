/**
 * AnomalyDetectionService — foundation for unusual metric changes.
 * Anomalies are informational only and are never auto-classified as security incidents.
 */
export {
  detectAnomalies as detectMetricAnomalies,
  updateBaselines,
  analyticsAggregationWorker,
} from "@/lib/analytics/aggregation-worker";

export const AnomalyDetectionService = {
  detect: async (organizationId: string) => {
    const { detectAnomalies } = await import("@/lib/analytics/aggregation-worker");
    return detectAnomalies(organizationId);
  },
};
