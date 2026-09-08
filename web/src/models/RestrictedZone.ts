import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface IZonePoint {
  x: number;
  y: number;
}

export interface IRestrictedZone extends Document {
  _id: Types.ObjectId;
  zoneId: string;
  organizationId: Types.ObjectId;
  name: string;
  cameraId: Types.ObjectId;
  buildingId: Types.ObjectId | null;
  roomId: Types.ObjectId | null;
  polygon: IZonePoint[];
  scheduleId: Types.ObjectId | null;
  allowedRoles: string[];
  status: "ACTIVE" | "INACTIVE";
  createdAt: Date;
  updatedAt: Date;
}

const PointSchema = new Schema<IZonePoint>({ x: Number, y: Number }, { _id: false });

const RestrictedZoneSchema = new Schema<IRestrictedZone>(
  {
    zoneId: { type: String, required: true, unique: true, trim: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    cameraId: { type: Schema.Types.ObjectId, ref: "Camera", required: true, index: true },
    buildingId: { type: Schema.Types.ObjectId, ref: "Building", default: null },
    roomId: { type: Schema.Types.ObjectId, ref: "Room", default: null },
    polygon: { type: [PointSchema], default: [] },
    scheduleId: { type: Schema.Types.ObjectId, ref: "DetectionSchedule", default: null },
    allowedRoles: { type: [String], default: [] },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true }
);

export const RestrictedZone: Model<IRestrictedZone> =
  mongoose.models.RestrictedZone ??
  mongoose.model<IRestrictedZone>("RestrictedZone", RestrictedZoneSchema);
