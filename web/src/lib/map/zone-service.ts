import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { orgFilter, getOrCreateCampus } from "@/lib/campus/service";
import {
  AssemblyArea,
  EmergencyExit,
  Geofence,
  MapAsset,
  MapObject,
  Zone,
  newMapId,
} from "@/models/Map";
import { validateLatLng, validatePolygonRing, toGeoPoint } from "@/lib/map/geo";
import {
  ASSET_TYPES,
  MAP_OBJECT_TYPES,
  ZONE_TYPES,
  type MapObjectType,
  type ZoneType,
} from "@/lib/map/constants";
import { logAuditEvent } from "@/lib/audit/log";
import type { IUser } from "@/models/User";

type AssetType = (typeof ASSET_TYPES)[number];
type AssetStatus = "ACTIVE" | "INACTIVE" | "MAINTENANCE" | "UNKNOWN";

export async function createMapObject(
  organizationId: string,
  user: IUser,
  data: {
    type: string;
    name: string;
    lat?: number;
    lng?: number;
    buildingId?: string;
    floorId?: string;
    metadata?: Record<string, unknown>;
  }
) {
  await connectDB();
  if (!(MAP_OBJECT_TYPES as readonly string[]).includes(data.type)) {
    throw new Error("Invalid map object type.");
  }
  let position = null;
  if (data.lat != null && data.lng != null) {
    const v = validateLatLng(data.lat, data.lng);
    if (!v.ok) throw new Error(v.error);
    position = toGeoPoint(data.lng, data.lat);
  }
  const campus = await getOrCreateCampus(organizationId);
  const objectId = newMapId("mobj");
  const obj = await MapObject.create({
    objectId,
    organizationId: new mongoose.Types.ObjectId(organizationId),
    campusId: campus._id,
    buildingId: data.buildingId ?? null,
    floorId: data.floorId ?? null,
    type: data.type as MapObjectType,
    name: data.name,
    position,
    metadata: data.metadata ?? {},
    status: "ACTIVE",
    locationMeta: {
      source: "ADMIN_CONFIGURATION",
      accuracyM: null,
      lastUpdated: new Date(),
    },
  });
  await logAuditEvent({
    actor: user,
    action: "MAP_OBJECT_CREATED",
    description: `Created map object ${data.name}`,
    targetType: "MapObject",
    targetId: objectId,
  });
  return obj;
}

export async function createZone(
  organizationId: string,
  user: IUser,
  data: {
    name: string;
    type: string;
    ring?: Array<[number, number]>;
    rules?: Array<Record<string, unknown>>;
  }
) {
  await connectDB();
  if (!(ZONE_TYPES as readonly string[]).includes(data.type)) throw new Error("Invalid zone type.");
  let geometry = null;
  if (data.ring?.length) {
    const v = validatePolygonRing(data.ring);
    if (!v.ok) throw new Error(v.error);
    geometry = { type: "Polygon" as const, coordinates: [data.ring] };
  }
  const campus = await getOrCreateCampus(organizationId);
  const zoneId = newMapId("zone");
  const zone = await Zone.create({
    zoneId,
    organizationId: new mongoose.Types.ObjectId(organizationId),
    campusId: campus._id,
    name: data.name,
    type: data.type as ZoneType,
    geometry,
    status: "ACTIVE",
    rules: data.rules ?? [],
    createdBy: user._id,
  });
  await logAuditEvent({
    actor: user,
    action: "ZONE_CREATED",
    description: `Created zone ${data.name}`,
    targetType: "Zone",
    targetId: zoneId,
  });
  return {
    zoneId: zone.zoneId,
    name: zone.name,
    type: zone.type,
    status: zone.status,
    rules: zone.rules,
  };
}

export async function createGeofence(
  organizationId: string,
  user: IUser,
  data: { name: string; zoneId?: string; ring?: Array<[number, number]>; triggers?: unknown[] }
) {
  await connectDB();
  let geometry = null;
  if (data.ring?.length) {
    const v = validatePolygonRing(data.ring);
    if (!v.ok) throw new Error(v.error);
    geometry = { type: "Polygon" as const, coordinates: [data.ring] };
  }
  const campus = await getOrCreateCampus(organizationId);
  const geofenceId = newMapId("geo");
  const g = await Geofence.create({
    geofenceId,
    organizationId: new mongoose.Types.ObjectId(organizationId),
    campusId: campus._id,
    name: data.name,
    zoneId: data.zoneId ?? null,
    geometry,
    status: "ACTIVE",
    triggers: (data.triggers ?? []) as Array<{ event: string; automationId?: string; action?: string }>,
  });
  await logAuditEvent({
    actor: user,
    action: "GEOFENCE_CREATED",
    description: `Created geofence ${data.name}`,
    targetType: "Geofence",
    targetId: geofenceId,
  });
  return { geofenceId: g.geofenceId, name: g.name, status: g.status };
}

export async function upsertExit(
  organizationId: string,
  user: IUser,
  data: {
    exitId?: string;
    name: string;
    lat?: number;
    lng?: number;
    status?: string;
    capacity?: number;
    accessible?: boolean;
    notes?: string;
    buildingId?: string;
    floorId?: string;
  }
) {
  await connectDB();
  const campus = await getOrCreateCampus(organizationId);
  let location = null;
  if (data.lat != null && data.lng != null) {
    const v = validateLatLng(data.lat, data.lng);
    if (!v.ok) throw new Error(v.error);
    location = toGeoPoint(data.lng, data.lat);
  }
  const exitId = data.exitId ?? newMapId("exit");
  const exit = await EmergencyExit.findOneAndUpdate(
    orgFilter(organizationId, { exitId }),
    {
      $set: {
        name: data.name,
        location,
        status: data.status ?? "UNKNOWN",
        capacity: data.capacity ?? null,
        accessible: data.accessible ?? true,
        notes: data.notes ?? "",
        buildingId: data.buildingId ?? null,
        floorId: data.floorId ?? null,
        campusId: campus._id,
        locationMeta: {
          source: "ADMIN_CONFIGURATION",
          accuracyM: null,
          lastUpdated: new Date(),
        },
      },
      $setOnInsert: {
        exitId,
        organizationId: new mongoose.Types.ObjectId(organizationId),
      },
    },
    { upsert: true, new: true }
  );
  await logAuditEvent({
    actor: user,
    action: "EXIT_UPDATED",
    description: `Updated emergency exit ${data.name}`,
    targetType: "EmergencyExit",
    targetId: exitId,
  });
  return exit;
}

export async function upsertAssembly(
  organizationId: string,
  user: IUser,
  data: {
    assemblyId?: string;
    name: string;
    lat?: number;
    lng?: number;
    capacity?: number;
    accessibility?: boolean;
    status?: string;
    notes?: string;
  }
) {
  await connectDB();
  const campus = await getOrCreateCampus(organizationId);
  let location = null;
  if (data.lat != null && data.lng != null) {
    const v = validateLatLng(data.lat, data.lng);
    if (!v.ok) throw new Error(v.error);
    location = toGeoPoint(data.lng, data.lat);
  }
  const assemblyId = data.assemblyId ?? newMapId("asm");
  const area = await AssemblyArea.findOneAndUpdate(
    orgFilter(organizationId, { assemblyId }),
    {
      $set: {
        name: data.name,
        location,
        capacity: data.capacity ?? null,
        accessibility: data.accessibility ?? true,
        status: data.status ?? "UNKNOWN",
        notes: data.notes ?? "",
        campusId: campus._id,
        locationMeta: {
          source: "ADMIN_CONFIGURATION",
          accuracyM: null,
          lastUpdated: new Date(),
        },
      },
      $setOnInsert: {
        assemblyId,
        organizationId: new mongoose.Types.ObjectId(organizationId),
      },
    },
    { upsert: true, new: true }
  );
  await logAuditEvent({
    actor: user,
    action: "ASSEMBLY_UPDATED",
    description: `Updated assembly area ${data.name}`,
    targetType: "AssemblyArea",
    targetId: assemblyId,
  });
  return area;
}

export async function createAsset(
  organizationId: string,
  user: IUser,
  data: {
    name: string;
    type: string;
    lat?: number;
    lng?: number;
    equipmentSubtype?: string;
    owner?: string;
    status?: string;
  }
) {
  await connectDB();
  if (!(ASSET_TYPES as readonly string[]).includes(data.type)) throw new Error("Invalid asset type.");
  const campus = await getOrCreateCampus(organizationId);
  let location = null;
  if (data.lat != null && data.lng != null) {
    const v = validateLatLng(data.lat, data.lng);
    if (!v.ok) throw new Error(v.error);
    location = toGeoPoint(data.lng, data.lat);
  }
  const assetId = newMapId("ast");
  const equipmentSubtype =
    data.equipmentSubtype &&
    (["FIRE_EXTINGUISHER", "AED", "FIRST_AID", "EMERGENCY_PHONE", "ALARM", "SAFETY_EQUIPMENT"] as const).includes(
      data.equipmentSubtype as "AED"
    )
      ? (data.equipmentSubtype as
          | "FIRE_EXTINGUISHER"
          | "AED"
          | "FIRST_AID"
          | "EMERGENCY_PHONE"
          | "ALARM"
          | "SAFETY_EQUIPMENT")
      : null;

  const asset = await MapAsset.create({
    assetId,
    organizationId: new mongoose.Types.ObjectId(organizationId),
    campusId: campus._id,
    name: data.name,
    type: data.type as AssetType,
    equipmentSubtype,
    location,
    status: (data.status as AssetStatus) ?? "UNKNOWN",
    owner: data.owner ?? "",
    locationMeta: {
      source: "ADMIN_CONFIGURATION",
      accuracyM: null,
      lastUpdated: new Date(),
    },
  });
  await logAuditEvent({
    actor: user,
    action: "ASSET_CREATED",
    description: `Created asset ${data.name}`,
    targetType: "MapAsset",
    targetId: assetId,
  });
  return {
    assetId: asset.assetId,
    name: asset.name,
    type: asset.type,
    status: asset.status,
  };
}

export async function getAssetDetail(organizationId: string, assetId: string) {
  await connectDB();
  const asset = await MapAsset.findOne(orgFilter(organizationId, { assetId }));
  if (!asset) return null;
  return {
    assetId: asset.assetId,
    name: asset.name,
    type: asset.type,
    equipmentSubtype: asset.equipmentSubtype,
    status: asset.status,
    owner: asset.owner,
    maintenanceNotes: asset.maintenanceNotes,
    lastInspection: asset.lastInspection?.toISOString() ?? null,
    location: asset.location ? { lat: asset.location.coordinates[1], lng: asset.location.coordinates[0] } : null,
    locationMeta: asset.locationMeta,
    relatedIncidents: [] as string[],
  };
}

export async function getMapAnalytics(organizationId: string) {
  await connectDB();
  const heatmap = await import("@/lib/map/map-service").then((m) =>
    m.getRiskHeatmap(organizationId, { timeRange: "30D" })
  );
  return {
    byArea: heatmap.cells.map((c) => ({
      area: c.name,
      risk: c.level,
      score: c.score,
      factors: c.factors,
    })),
    explanation: heatmap.explanation,
    from: heatmap.from,
    to: heatmap.to,
  };
}
