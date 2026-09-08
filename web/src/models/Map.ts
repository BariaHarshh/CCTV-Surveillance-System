import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import crypto from "crypto";
import {
  ASSEMBLY_STATUSES,
  ASSET_STATUSES,
  ASSET_TYPES,
  EQUIPMENT_TYPES,
  EXIT_STATUSES,
  FLOOR_PLAN_STATUSES,
  GEO_EVENT_TYPES,
  MAP_OBJECT_TYPES,
  ZONE_TYPES,
} from "@/lib/map/constants";

export function newMapId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

/** GeoJSON-compatible point stored for 2dsphere indexes. */
export interface IGeoPoint {
  type: "Point";
  coordinates: [number, number]; // [lng, lat]
}

export interface IGeoPolygon {
  type: "Polygon";
  coordinates: number[][][]; // rings of [lng, lat]
}

export interface ILocationMeta {
  source: string;
  accuracyM: number | null;
  lastUpdated: Date | null;
}

const LocationMetaSchema = new Schema<ILocationMeta>(
  {
    source: { type: String, default: "ADMIN_CONFIGURATION" },
    accuracyM: { type: Number, default: null },
    lastUpdated: { type: Date, default: null },
  },
  { _id: false }
);

const GeoPointSchema = new Schema<IGeoPoint>(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true },
  },
  { _id: false }
);

const GeoPolygonSchema = new Schema<IGeoPolygon>(
  {
    type: { type: String, enum: ["Polygon"], default: "Polygon" },
    coordinates: { type: [[[Number]]], required: true },
  },
  { _id: false }
);

/* ─── Floor (digital twin node) ─── */
export interface IFloor extends Document {
  floorId: string;
  organizationId: Types.ObjectId;
  campusId: Types.ObjectId;
  buildingId: Types.ObjectId;
  level: number;
  name: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const FloorSchema = new Schema<IFloor>(
  {
    floorId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    campusId: { type: Schema.Types.ObjectId, required: true, index: true },
    buildingId: { type: Schema.Types.ObjectId, required: true, index: true },
    level: { type: Number, required: true },
    name: { type: String, required: true },
    status: { type: String, default: "ACTIVE" },
  },
  { timestamps: true }
);
FloorSchema.index({ organizationId: 1, buildingId: 1, level: 1 }, { unique: true });

export const Floor: Model<IFloor> =
  mongoose.models.Floor ?? mongoose.model<IFloor>("Floor", FloorSchema);

/* ─── FloorPlan ─── */
export interface IFloorPlan extends Document {
  floorPlanId: string;
  organizationId: Types.ObjectId;
  campusId: Types.ObjectId;
  buildingId: Types.ObjectId;
  floorId: string;
  imageReference: string;
  mimeType: string;
  originalName: string;
  version: number;
  width: number;
  height: number;
  status: (typeof FLOOR_PLAN_STATUSES)[number];
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const FloorPlanSchema = new Schema<IFloorPlan>(
  {
    floorPlanId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    campusId: { type: Schema.Types.ObjectId, required: true },
    buildingId: { type: Schema.Types.ObjectId, required: true, index: true },
    floorId: { type: String, required: true, index: true },
    imageReference: { type: String, required: true },
    mimeType: { type: String, required: true },
    originalName: { type: String, default: "" },
    version: { type: Number, default: 1 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    status: { type: String, enum: FLOOR_PLAN_STATUSES, default: "DRAFT", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);
FloorPlanSchema.index({ organizationId: 1, floorId: 1, status: 1 });

export const FloorPlan: Model<IFloorPlan> =
  mongoose.models.FloorPlan ?? mongoose.model<IFloorPlan>("FloorPlan", FloorPlanSchema);

/* ─── MapObject ─── */
export interface IMapObject extends Document {
  objectId: string;
  organizationId: Types.ObjectId;
  campusId: Types.ObjectId | null;
  buildingId: Types.ObjectId | null;
  floorId: string | null;
  type: (typeof MAP_OBJECT_TYPES)[number];
  name: string;
  position: IGeoPoint | null;
  /** Floor-plan relative 0–1 coords when indoors */
  mapPosition: { x: number; y: number } | null;
  metadata: Record<string, unknown>;
  status: string;
  locationMeta: ILocationMeta;
  linkedResourceType: string | null;
  linkedResourceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const MapObjectSchema = new Schema<IMapObject>(
  {
    objectId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    campusId: { type: Schema.Types.ObjectId, default: null, index: true },
    buildingId: { type: Schema.Types.ObjectId, default: null },
    floorId: { type: String, default: null },
    type: { type: String, enum: MAP_OBJECT_TYPES, required: true, index: true },
    name: { type: String, required: true },
    position: { type: GeoPointSchema, default: null },
    mapPosition: {
      x: { type: Number, default: null },
      y: { type: Number, default: null },
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, default: "ACTIVE", index: true },
    locationMeta: { type: LocationMetaSchema, default: () => ({}) },
    linkedResourceType: { type: String, default: null },
    linkedResourceId: { type: String, default: null },
  },
  { timestamps: true }
);
MapObjectSchema.index({ position: "2dsphere" });
MapObjectSchema.index({ organizationId: 1, type: 1, status: 1 });

export const MapObject: Model<IMapObject> =
  mongoose.models.MapObject ?? mongoose.model<IMapObject>("MapObject", MapObjectSchema);

/* ─── Zone ─── */
export interface IZone extends Document {
  zoneId: string;
  organizationId: Types.ObjectId;
  campusId: Types.ObjectId | null;
  name: string;
  type: (typeof ZONE_TYPES)[number];
  geometry: IGeoPolygon | null;
  /** Floor-plan relative polygon when indoors */
  floorGeometry: Array<{ x: number; y: number }> | null;
  buildingId: Types.ObjectId | null;
  floorId: string | null;
  status: string;
  rules: Array<Record<string, unknown>>;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const ZoneSchema = new Schema<IZone>(
  {
    zoneId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    campusId: { type: Schema.Types.ObjectId, default: null },
    name: { type: String, required: true },
    type: { type: String, enum: ZONE_TYPES, required: true },
    geometry: { type: GeoPolygonSchema, default: null },
    floorGeometry: { type: [{ x: Number, y: Number }], default: null },
    buildingId: { type: Schema.Types.ObjectId, default: null },
    floorId: { type: String, default: null },
    status: { type: String, default: "ACTIVE", index: true },
    rules: { type: Schema.Types.Mixed, default: [] },
    createdBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);
ZoneSchema.index({ geometry: "2dsphere" });
ZoneSchema.index({ organizationId: 1, type: 1 });

export const Zone: Model<IZone> =
  mongoose.models.Zone ?? mongoose.model<IZone>("Zone", ZoneSchema);

/* ─── Geofence ─── */
export interface IGeofence extends Document {
  geofenceId: string;
  organizationId: Types.ObjectId;
  campusId: Types.ObjectId | null;
  name: string;
  zoneId: string | null;
  geometry: IGeoPolygon | null;
  status: string;
  triggers: Array<{ event: string; automationId?: string; action?: string }>;
  createdAt: Date;
  updatedAt: Date;
}

const GeofenceSchema = new Schema<IGeofence>(
  {
    geofenceId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    campusId: { type: Schema.Types.ObjectId, default: null },
    name: { type: String, required: true },
    zoneId: { type: String, default: null },
    geometry: { type: GeoPolygonSchema, default: null },
    status: { type: String, default: "ACTIVE" },
    triggers: { type: Schema.Types.Mixed, default: [] },
  },
  { timestamps: true }
);
GeofenceSchema.index({ geometry: "2dsphere" });

export const Geofence: Model<IGeofence> =
  mongoose.models.Geofence ?? mongoose.model<IGeofence>("Geofence", GeofenceSchema);

/* ─── GeoEvent ─── */
export interface IGeoEvent extends Document {
  eventId: string;
  organizationId: Types.ObjectId;
  entityType: string;
  entityId: string;
  eventType: (typeof GEO_EVENT_TYPES)[number];
  location: IGeoPoint | null;
  timestamp: Date;
  accuracy: number | null;
  source: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const GeoEventSchema = new Schema<IGeoEvent>(
  {
    eventId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    eventType: { type: String, enum: GEO_EVENT_TYPES, required: true },
    location: { type: GeoPointSchema, default: null },
    timestamp: { type: Date, required: true, index: true },
    accuracy: { type: Number, default: null },
    source: { type: String, default: "SYSTEM" },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
GeoEventSchema.index({ location: "2dsphere" });
GeoEventSchema.index({ organizationId: 1, timestamp: -1 });

export const GeoEvent: Model<IGeoEvent> =
  mongoose.models.GeoEvent ?? mongoose.model<IGeoEvent>("GeoEvent", GeoEventSchema);

/* ─── EmergencyExit ─── */
export interface IEmergencyExit extends Document {
  exitId: string;
  organizationId: Types.ObjectId;
  campusId: Types.ObjectId | null;
  buildingId: Types.ObjectId | null;
  floorId: string | null;
  name: string;
  location: IGeoPoint | null;
  mapPosition: { x: number; y: number } | null;
  status: (typeof EXIT_STATUSES)[number];
  capacity: number | null;
  accessible: boolean;
  lastInspection: Date | null;
  notes: string;
  locationMeta: ILocationMeta;
  createdAt: Date;
  updatedAt: Date;
}

const EmergencyExitSchema = new Schema<IEmergencyExit>(
  {
    exitId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    campusId: { type: Schema.Types.ObjectId, default: null },
    buildingId: { type: Schema.Types.ObjectId, default: null },
    floorId: { type: String, default: null },
    name: { type: String, required: true },
    location: { type: GeoPointSchema, default: null },
    mapPosition: { x: { type: Number }, y: { type: Number } },
    status: { type: String, enum: EXIT_STATUSES, default: "UNKNOWN" },
    capacity: { type: Number, default: null },
    accessible: { type: Boolean, default: true },
    lastInspection: { type: Date, default: null },
    notes: { type: String, default: "" },
    locationMeta: { type: LocationMetaSchema, default: () => ({}) },
  },
  { timestamps: true }
);
EmergencyExitSchema.index({ location: "2dsphere" });

export const EmergencyExit: Model<IEmergencyExit> =
  mongoose.models.EmergencyExit ??
  mongoose.model<IEmergencyExit>("EmergencyExit", EmergencyExitSchema);

/* ─── AssemblyArea ─── */
export interface IAssemblyArea extends Document {
  assemblyId: string;
  organizationId: Types.ObjectId;
  campusId: Types.ObjectId | null;
  name: string;
  location: IGeoPoint | null;
  capacity: number | null;
  accessibility: boolean;
  status: (typeof ASSEMBLY_STATUSES)[number];
  notes: string;
  locationMeta: ILocationMeta;
  createdAt: Date;
  updatedAt: Date;
}

const AssemblyAreaSchema = new Schema<IAssemblyArea>(
  {
    assemblyId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    campusId: { type: Schema.Types.ObjectId, default: null },
    name: { type: String, required: true },
    location: { type: GeoPointSchema, default: null },
    capacity: { type: Number, default: null },
    accessibility: { type: Boolean, default: true },
    status: { type: String, enum: ASSEMBLY_STATUSES, default: "UNKNOWN" },
    notes: { type: String, default: "" },
    locationMeta: { type: LocationMetaSchema, default: () => ({}) },
  },
  { timestamps: true }
);
AssemblyAreaSchema.index({ location: "2dsphere" });

export const AssemblyArea: Model<IAssemblyArea> =
  mongoose.models.AssemblyArea ??
  mongoose.model<IAssemblyArea>("AssemblyArea", AssemblyAreaSchema);

/* ─── MapAsset (non-camera campus assets) ─── */
export interface IMapAsset extends Document {
  assetId: string;
  organizationId: Types.ObjectId;
  campusId: Types.ObjectId | null;
  buildingId: Types.ObjectId | null;
  floorId: string | null;
  name: string;
  type: (typeof ASSET_TYPES)[number];
  equipmentSubtype: (typeof EQUIPMENT_TYPES)[number] | null;
  location: IGeoPoint | null;
  mapPosition: { x: number; y: number } | null;
  status: (typeof ASSET_STATUSES)[number];
  owner: string;
  maintenanceNotes: string;
  lastInspection: Date | null;
  locationMeta: ILocationMeta;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const MapAssetSchema = new Schema<IMapAsset>(
  {
    assetId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    campusId: { type: Schema.Types.ObjectId, default: null },
    buildingId: { type: Schema.Types.ObjectId, default: null },
    floorId: { type: String, default: null },
    name: { type: String, required: true },
    type: { type: String, enum: ASSET_TYPES, required: true, index: true },
    equipmentSubtype: { type: String, default: null },
    location: { type: GeoPointSchema, default: null },
    mapPosition: { x: { type: Number }, y: { type: Number } },
    status: { type: String, enum: ASSET_STATUSES, default: "UNKNOWN" },
    owner: { type: String, default: "" },
    maintenanceNotes: { type: String, default: "" },
    lastInspection: { type: Date, default: null },
    locationMeta: { type: LocationMetaSchema, default: () => ({}) },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);
MapAssetSchema.index({ location: "2dsphere" });
MapAssetSchema.index({ organizationId: 1, type: 1 });

export const MapAsset: Model<IMapAsset> =
  mongoose.models.MapAsset ?? mongoose.model<IMapAsset>("MapAsset", MapAssetSchema);

/* ─── Emergency affected area (explicit config only) ─── */
export interface IEmergencyMapOverlay extends Document {
  overlayId: string;
  organizationId: Types.ObjectId;
  emergencyId: string;
  kind: "POINT" | "CIRCLE" | "POLYGON";
  point: IGeoPoint | null;
  radiusM: number | null;
  polygon: IGeoPolygon | null;
  blockedAreas: IGeoPolygon[];
  knownHazards: Array<{ name: string; location: IGeoPoint | null; notes: string }>;
  source: string;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const EmergencyMapOverlaySchema = new Schema<IEmergencyMapOverlay>(
  {
    overlayId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    emergencyId: { type: String, required: true, unique: true },
    kind: { type: String, enum: ["POINT", "CIRCLE", "POLYGON"], required: true },
    point: { type: GeoPointSchema, default: null },
    radiusM: { type: Number, default: null },
    polygon: { type: GeoPolygonSchema, default: null },
    blockedAreas: { type: [GeoPolygonSchema], default: [] },
    knownHazards: { type: Schema.Types.Mixed, default: [] },
    source: { type: String, default: "VERIFIED_CONFIGURATION" },
    createdBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

export const EmergencyMapOverlay: Model<IEmergencyMapOverlay> =
  mongoose.models.EmergencyMapOverlay ??
  mongoose.model<IEmergencyMapOverlay>("EmergencyMapOverlay", EmergencyMapOverlaySchema);

/* ─── Location retention policy ─── */
export interface ILocationRetentionPolicy extends Document {
  organizationId: Types.ObjectId;
  locationHistoryDays: number;
  teamLocationDays: number;
  assetLocationDays: number;
  cameraLocationDays: number;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const LocationRetentionSchema = new Schema<ILocationRetentionPolicy>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, unique: true },
    locationHistoryDays: { type: Number, default: 90, min: 1 },
    teamLocationDays: { type: Number, default: 30, min: 1 },
    assetLocationDays: { type: Number, default: 365, min: 1 },
    cameraLocationDays: { type: Number, default: 365, min: 1 },
    updatedBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

export const LocationRetentionPolicy: Model<ILocationRetentionPolicy> =
  mongoose.models.LocationRetentionPolicy ??
  mongoose.model<ILocationRetentionPolicy>("LocationRetentionPolicy", LocationRetentionSchema);
