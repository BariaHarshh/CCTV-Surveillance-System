import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canEditMap, canViewMap } from "@/lib/map/permissions";
import { connectDB } from "@/lib/db/connect";
import { orgFilter } from "@/lib/campus/service";
import { MapAsset } from "@/models/Map";
import { createAsset, getAssetDetail, upsertAssembly, upsertExit } from "@/lib/map/zone-service";

export async function GET(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewMap(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const url = new URL(request.url);
    const assetId = url.searchParams.get("assetId");
    if (assetId) {
      const detail = await getAssetDetail(organizationId, assetId);
      if (!detail) return apiError("Asset not found", 404, "NOT_FOUND");
      return apiSuccess({ asset: detail });
    }
    await connectDB();
    const assets = await MapAsset.find(orgFilter(organizationId)).sort({ name: 1 }).limit(500);
    return apiSuccess({
      assets: assets.map((a) => ({
        assetId: a.assetId,
        name: a.name,
        type: a.type,
        status: a.status,
        hasLocation: Boolean(a.location),
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canEditMap(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const body = await request.json();
    const kind = String(body.kind || "asset");
    if (kind === "exit") {
      const exit = await upsertExit(organizationId, user, body);
      return apiSuccess({ exit: { exitId: exit.exitId, name: exit.name, status: exit.status } }, 201);
    }
    if (kind === "assembly") {
      const area = await upsertAssembly(organizationId, user, body);
      return apiSuccess(
        { assembly: { assemblyId: area.assemblyId, name: area.name, status: area.status } },
        201
      );
    }
    const asset = await createAsset(organizationId, user, {
      name: String(body.name || "Asset"),
      type: String(body.type || "OTHER"),
      lat: body.lat,
      lng: body.lng,
      equipmentSubtype: body.equipmentSubtype,
      owner: body.owner,
      status: body.status,
    });
    return apiSuccess({ asset }, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
