import { connectDB } from "@/lib/db/connect";
import { AIDetectionConfig } from "@/models/AIDetectionConfig";
import { Camera } from "@/models/Camera";
import { Event } from "@/models/Event";
import { orgFilter } from "@/lib/campus/service";
import { getSocketIO } from "@/lib/monitoring/socket-emitter";
import { queueMetrics } from "@/lib/ai/queue";
import { AIModelRegistry } from "@/models/AIModelRegistry";
import type { AIHealthStatus } from "@/lib/ai/constants";

export async function getAIHealthMetrics(organizationId: string) {
  await connectDB();

  const [cameras, configs, models, recentEvents] = await Promise.all([
    Camera.countDocuments(orgFilter(organizationId)),
    AIDetectionConfig.countDocuments(orgFilter(organizationId, { status: "ACTIVE" })),
    AIModelRegistry.find().select("name type status provider"),
    Event.countDocuments(orgFilter(organizationId, { detectedAt: { $gte: new Date(Date.now() - 60_000) } })),
  ]);

  const socketOk = Boolean(getSocketIO());
  const activeModels = models.filter((m) => m.status === "ACTIVE").length;

  let detectionStatus: AIHealthStatus = "HEALTHY";
  if (activeModels === 0) detectionStatus = "DEGRADED";
  if (queueMetrics.failedJobs > 5) detectionStatus = "ERROR";

  return {
    services: [
      { name: "Detection Service", status: detectionStatus, detail: `${activeModels} active model(s)` },
      { name: "Model Registry", status: models.length > 0 ? "HEALTHY" : "DEGRADED", detail: `${models.length} registered` },
      { name: "Camera Processing", status: configs > 0 ? "HEALTHY" : "OFFLINE", detail: `${configs}/${cameras} cameras with AI` },
      { name: "Event Queue", status: queueMetrics.failedJobs > 0 ? "DEGRADED" : "HEALTHY", detail: `${queueMetrics.eventJobs} processed` },
      { name: "WebSocket", status: socketOk ? "HEALTHY" : "OFFLINE", detail: socketOk ? "Connected" : "Unavailable" },
      { name: "Alert Service", status: "HEALTHY", detail: "Operational" },
    ],
    metrics: {
      camerasProcessing: configs,
      eventsPerMinute: recentEvents,
      averageDetectionLatencyMs: null,
      eventQueueDepth: queueMetrics.eventJobs,
      failedDetections: queueMetrics.failedJobs,
      aiServiceUptime: queueMetrics.lastProcessedAt?.toISOString() ?? null,
    },
    models: models.map((m) => ({
      modelId: m._id.toString(),
      name: m.name,
      type: m.type,
      provider: m.provider,
      status: m.status,
    })),
  };
}
