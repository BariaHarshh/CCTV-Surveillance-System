import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canEditMap } from "@/lib/map/permissions";
import { validateLatLng, validatePolygonRing } from "@/lib/map/geo";
import { createZone, createAsset, upsertExit } from "@/lib/map/zone-service";
import { connectDB } from "@/lib/db/connect";
import { Camera } from "@/models/Camera";
import { orgFilter } from "@/lib/campus/service";
import { logAuditEvent } from "@/lib/audit/log";

export async function POST(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canEditMap(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const body = await request.json();
    const format = String(body.format || "GEOJSON").toUpperCase();
    const imported: string[] = [];
    const errors: string[] = [];

    if (format === "GEOJSON") {
      const fc = body.geojson;
      if (!fc || fc.type !== "FeatureCollection" || !Array.isArray(fc.features)) {
        return apiError("Invalid GeoJSON FeatureCollection", 400, "VALIDATION");
      }
      for (const feature of fc.features.slice(0, 500)) {
        try {
          const props = feature.properties || {};
          const kind = String(props.kind || props.type || "object").toLowerCase();
          const geom = feature.geometry;
          if (geom?.type === "Point") {
            const [lng, lat] = geom.coordinates;
            const v = validateLatLng(lat, lng);
            if (!v.ok) {
              errors.push(v.error);
              continue;
            }
            if (kind === "exit") {
              await upsertExit(organizationId, user, {
                name: String(props.name || "Exit"),
                lat,
                lng,
                status: props.status,
              });
              imported.push("exit");
            } else if (kind === "asset") {
              await createAsset(organizationId, user, {
                name: String(props.name || "Asset"),
                type: String(props.assetType || "OTHER"),
                lat,
                lng,
              });
              imported.push("asset");
            } else if (kind === "camera" && props.cameraId) {
              await connectDB();
              await Camera.findOneAndUpdate(
                orgFilter(organizationId, { cameraId: String(props.cameraId) }),
                {
                  $set: {
                    mapLocation: {
                      lat,
                      lng,
                      source: "GEOJSON_IMPORT",
                      lastUpdated: new Date(),
                      calibrated: false,
                    },
                  },
                }
              );
              imported.push("camera");
            }
          } else if (geom?.type === "Polygon" && kind === "zone") {
            const ring = geom.coordinates?.[0] as Array<[number, number]>;
            const v = validatePolygonRing(ring);
            if (!v.ok) {
              errors.push(v.error);
              continue;
            }
            await createZone(organizationId, user, {
              name: String(props.name || "Imported Zone"),
              type: String(props.zoneType || "CUSTOM"),
              ring,
            });
            imported.push("zone");
          }
        } catch (err) {
          errors.push(err instanceof Error ? err.message : "Import row failed");
        }
      }
    } else if (format === "CSV") {
      const rows = String(body.csv || "").split(/\r?\n/).filter(Boolean);
      const header = rows.shift()?.split(",").map((h) => h.trim().toLowerCase()) ?? [];
      for (const line of rows.slice(0, 500)) {
        const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        const rec: Record<string, string> = {};
        header.forEach((h, i) => {
          rec[h] = cols[i] ?? "";
        });
        const lat = Number(rec.lat);
        const lng = Number(rec.lng);
        const v = validateLatLng(lat, lng);
        if (!v.ok) {
          errors.push(v.error);
          continue;
        }
        await createAsset(organizationId, user, {
          name: rec.name || "Imported",
          type: rec.type || "OTHER",
          lat,
          lng,
        });
        imported.push("asset");
      }
    } else {
      return apiError("Unsupported format", 400, "VALIDATION");
    }

    await logAuditEvent({
      actor: user,
      action: "MAP_OBJECT_CREATED",
      description: `Imported ${imported.length} map features via ${format}`,
      metadata: { count: imported.length, errors: errors.length },
    });

    return apiSuccess({ imported: imported.length, errors: errors.slice(0, 20) });
  } catch (e) {
    return handleApiError(e);
  }
}
