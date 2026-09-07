import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canEditMap, canViewMap } from "@/lib/map/permissions";
import { connectDB } from "@/lib/db/connect";
import { Camera } from "@/models/Camera";
import { orgFilter } from "@/lib/campus/service";
import { validateLatLng } from "@/lib/map/geo";
import { logAuditEvent } from "@/lib/audit/log";
import { mapCameraHealthStatus } from "@/lib/map/map-service";
import { Event } from "@/models/Event";

export async function GET(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewMap(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const url = new URL(request.url);
    const cameraId = url.searchParams.get("cameraId");
    if (!cameraId) return apiError("cameraId required", 400, "VALIDATION");
    await connectDB();
    const camera = await Camera.findOne(
      orgFilter(organizationId, {
        $or: [{ cameraId }, { _id: cameraId }],
      })
    );
    if (!camera) return apiError("Camera not found", 404, "NOT_FOUND");
    const recentEvents = await Event.find(orgFilter(organizationId, { cameraId: camera._id }))
      .sort({ createdAt: -1 })
      .limit(5)
      .select("eventId type createdAt")
      .lean()
      .catch(() => []);

    return apiSuccess({
      health: {
        cameraId: camera.cameraId,
        name: camera.name,
        status: mapCameraHealthStatus(camera.status),
        rawStatus: camera.status,
        lastSeen: camera.lastSeen?.toISOString() ?? null,
        lastTestAt: camera.lastTestAt?.toISOString() ?? null,
        lastTestSuccess: camera.lastTestSuccess,
        latency: null,
        recentErrors: camera.status === "ERROR" ? ["Last health status ERROR"] : [],
        aiStatus: "UNKNOWN",
        location: camera.mapLocation,
        buildingId: camera.buildingId?.toString() ?? null,
        floor: camera.floor,
        recentEvents: (recentEvents as Array<Record<string, unknown>>).map((e) => ({
          eventId: e.eventId,
          type: e.type,
          at: e.createdAt,
        })),
        coverageDisclaimer:
          "Coverage radius/direction are configuration estimates unless calibrated.",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canEditMap(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const body = await request.json();
    const cameraId = String(body.cameraId || "");
    if (!cameraId) return apiError("cameraId required", 400, "VALIDATION");
    if (body.lat != null && body.lng != null) {
      const v = validateLatLng(Number(body.lat), Number(body.lng));
      if (!v.ok) return apiError(v.error, 400, "VALIDATION");
    }
    await connectDB();
    const camera = await Camera.findOne(
      orgFilter(organizationId, {
        $or: [{ cameraId }, { _id: cameraId }],
      })
    );
    if (!camera) return apiError("Camera not found", 404, "NOT_FOUND");

    camera.mapLocation = {
      lat: body.lat != null ? Number(body.lat) : camera.mapLocation?.lat ?? null,
      lng: body.lng != null ? Number(body.lng) : camera.mapLocation?.lng ?? null,
      viewingDirectionDeg:
        body.viewingDirectionDeg != null
          ? Number(body.viewingDirectionDeg)
          : camera.mapLocation?.viewingDirectionDeg ?? null,
      coverageRadiusM:
        body.coverageRadiusM != null
          ? Number(body.coverageRadiusM)
          : camera.mapLocation?.coverageRadiusM ?? null,
      coverageAngleDeg:
        body.coverageAngleDeg != null
          ? Number(body.coverageAngleDeg)
          : camera.mapLocation?.coverageAngleDeg ?? null,
      mapX: body.mapX != null ? Number(body.mapX) : camera.mapLocation?.mapX ?? null,
      mapY: body.mapY != null ? Number(body.mapY) : camera.mapLocation?.mapY ?? null,
      source: String(body.source || "ADMIN_CONFIGURATION"),
      accuracyM: body.accuracyM != null ? Number(body.accuracyM) : camera.mapLocation?.accuracyM ?? null,
      lastUpdated: new Date(),
      calibrated: Boolean(body.calibrated ?? camera.mapLocation?.calibrated),
    };
    await camera.save();
    await logAuditEvent({
      actor: user,
      action: "CAMERA_UPDATED",
      description: `Updated camera map location for ${camera.cameraId}`,
      targetType: "Camera",
      targetId: camera._id,
    });
    return apiSuccess({
      cameraId: camera.cameraId,
      mapLocation: camera.mapLocation,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
