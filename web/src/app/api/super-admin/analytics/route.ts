import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { analyticsService } from "@/lib/analytics/analytics-service";
import { connectDB } from "@/lib/db/connect";
import { Organization } from "@/models/Organization";
import { Camera } from "@/models/Camera";
import { Event } from "@/models/Event";
import { Alert } from "@/models/Alert";
import { getSocketIO } from "@/lib/monitoring/socket-emitter";

export async function GET() {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    await connectDB();
    const platform = await analyticsService.platform();

    const orgs = await Organization.find({ deletedAt: null })
      .select("basicInformation.name status")
      .limit(100)
      .lean();
    const comparison = [];
    for (const org of orgs.slice(0, 50)) {
      const [cameras, online, events, alerts] = await Promise.all([
        Camera.countDocuments({ organizationId: org._id }),
        Camera.countDocuments({ organizationId: org._id, status: "ONLINE" }),
        Event.countDocuments({ organizationId: org._id, source: { $ne: "TEST" } }),
        Alert.countDocuments({ organizationId: org._id, source: { $ne: "TEST" } }),
      ]);
      comparison.push({
        organization: org.basicInformation?.name ?? "Unknown",
        status: org.status,
        cameras,
        events,
        alerts,
        availability: cameras ? Math.round((online / cameras) * 1000) / 10 : null,
        active: org.status === "ACTIVE",
      });
    }

    return apiSuccess({
      platform,
      comparison,
      health: {
        api: "HEALTHY",
        database: "HEALTHY",
        websocket: getSocketIO() ? "HEALTHY" : "DEGRADED",
        overall: getSocketIO() ? "HEALTHY" : "DEGRADED",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
