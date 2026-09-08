import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canManageZones, canViewMap } from "@/lib/map/permissions";
import { connectDB } from "@/lib/db/connect";
import { orgFilter } from "@/lib/campus/service";
import { Zone } from "@/models/Map";
import { createZone, createGeofence, createMapObject } from "@/lib/map/zone-service";

export async function GET() {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewMap(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    await connectDB();
    const zones = await Zone.find(orgFilter(organizationId)).sort({ name: 1 }).limit(200);
    return apiSuccess({
      zones: zones.map((z) => ({
        zoneId: z.zoneId,
        name: z.name,
        type: z.type,
        status: z.status,
        rules: z.rules,
        hasGeometry: Boolean(z.geometry),
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canManageZones(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const body = await request.json();
    const kind = String(body.kind || "zone");
    if (kind === "geofence") {
      const g = await createGeofence(organizationId, user, {
        name: String(body.name || "Geofence"),
        zoneId: body.zoneId,
        ring: body.ring,
        triggers: body.triggers,
      });
      return apiSuccess({ geofence: g }, 201);
    }
    if (kind === "object") {
      const obj = await createMapObject(organizationId, user, {
        type: String(body.type || "OTHER"),
        name: String(body.name || "Object"),
        lat: body.lat,
        lng: body.lng,
        buildingId: body.buildingId,
        floorId: body.floorId,
        metadata: body.metadata,
      });
      return apiSuccess({ object: { objectId: obj.objectId, name: obj.name, type: obj.type } }, 201);
    }
    const zone = await createZone(organizationId, user, {
      name: String(body.name || "Zone"),
      type: String(body.type || "CUSTOM"),
      ring: body.ring,
      rules: body.rules,
    });
    return apiSuccess({ zone }, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
