import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import { CAMERA_STATUSES } from "@/lib/campus/constants";

export type CameraStatus = (typeof CAMERA_STATUSES)[number];

export interface ICameraConnection {
  streamUrl: string;
  protocol: string;
  connectionType: string;
  usernameEncrypted: string;
  passwordEncrypted: string;
}

/** Optional geospatial placement — does not create a separate camera entity. */
export interface ICameraMapLocation {
  lat: number | null;
  lng: number | null;
  viewingDirectionDeg: number | null;
  /** Estimated coverage radius in meters (configuration, not calibrated geometry). */
  coverageRadiusM: number | null;
  /** Estimated horizontal FOV in degrees (configuration estimate). */
  coverageAngleDeg: number | null;
  mapX: number | null;
  mapY: number | null;
  source: string;
  accuracyM: number | null;
  lastUpdated: Date | null;
  /** When false/absent, UI must label coverage as estimate. */
  calibrated: boolean;
}

export interface ICamera extends Document {
  _id: Types.ObjectId;
  cameraId: string;
  organizationId: Types.ObjectId;
  campusId: Types.ObjectId;
  buildingId: Types.ObjectId | null;
  roomId: Types.ObjectId | null;
  floor: number | null;
  areaLabel: string;
  name: string;
  type: string;
  manufacturer: string;
  deviceModel: string;
  serialNumber: string;
  connection: ICameraConnection;
  status: CameraStatus;
  lastSeen: Date | null;
  lastTestAt: Date | null;
  lastTestSuccess: boolean | null;
  mapLocation: ICameraMapLocation;
  createdAt: Date;
  updatedAt: Date;
}

const ConnectionSchema = new Schema<ICameraConnection>(
  {
    streamUrl: { type: String, default: "" },
    protocol: { type: String, default: "RTSP" },
    connectionType: { type: String, default: "Wired" },
    usernameEncrypted: { type: String, default: "", select: false },
    passwordEncrypted: { type: String, default: "", select: false },
  },
  { _id: false }
);

const CameraMapLocationSchema = new Schema<ICameraMapLocation>(
  {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    viewingDirectionDeg: { type: Number, default: null },
    coverageRadiusM: { type: Number, default: null },
    coverageAngleDeg: { type: Number, default: null },
    mapX: { type: Number, default: null },
    mapY: { type: Number, default: null },
    source: { type: String, default: "ADMIN_CONFIGURATION" },
    accuracyM: { type: Number, default: null },
    lastUpdated: { type: Date, default: null },
    calibrated: { type: Boolean, default: false },
  },
  { _id: false }
);

const CameraSchema = new Schema<ICamera>(
  {
    cameraId: { type: String, required: true, unique: true, trim: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    campusId: { type: Schema.Types.ObjectId, ref: "Campus", required: true, index: true },
    buildingId: { type: Schema.Types.ObjectId, ref: "Building", default: null },
    roomId: { type: Schema.Types.ObjectId, ref: "Room", default: null },
    floor: { type: Number, default: null },
    areaLabel: { type: String, default: "" },
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true },
    manufacturer: { type: String, default: "" },
    deviceModel: { type: String, default: "" },
    serialNumber: { type: String, default: "" },
    connection: { type: ConnectionSchema, default: () => ({}) },
    status: { type: String, enum: CAMERA_STATUSES, default: "OFFLINE" },
    lastSeen: { type: Date, default: null },
    lastTestAt: { type: Date, default: null },
    lastTestSuccess: { type: Boolean, default: null },
    mapLocation: { type: CameraMapLocationSchema, default: () => ({}) },
  },
  { timestamps: true }
);

CameraSchema.index({ organizationId: 1, status: 1 });
CameraSchema.index({ "mapLocation.lat": 1, "mapLocation.lng": 1 });

export const Camera: Model<ICamera> =
  mongoose.models.Camera ?? mongoose.model<ICamera>("Camera", CameraSchema);
